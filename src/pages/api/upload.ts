import type { NextApiRequest, NextApiResponse } from 'next';
import { getInfo, validateURL, type getInfoOptions, getVideoID } from 'ytdl-core';
import ms from "ms";
import { v4 as uuidv4 } from "uuid";
import { getClientIp } from "request-ip";
import projectConfig from '@/components/config/ProjectConfig';

// redis
import redis from "@/components/redis/Client";

// aws import
import { CreateJobCommand } from '@aws-sdk/client-mediaconvert';
import { HeadObjectCommand, type HeadObjectCommandInput } from '@aws-sdk/client-s3';
import { InvokeCommand } from "@aws-sdk/client-lambda";

// aws client import
import S3Client from '@/components/amazon-client/S3';
import MediaConvertClient from "@/components/amazon-client/MediaConvert";
import LambdaClient from '@/components/amazon-client/Lambda';

// utilities
import secondsToColonNotation from '@/components/hooks/secondsToColonNotation';
import findAppropriateVideoFormat from "@/components/hooks/findAppropriateVideoFormat";

export const config = {
  maxDuration: 60
};

interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    url: string;
    duration: [number, number];

    quality?: string;
  };
};

export default async function handler(req: ExtendedNextApiRequest, res: NextApiResponse) {
  try {
    if (req?.method !== "POST") {
      return res.status(400).send("invalid request method.");
    };

    const body = req.body;
    if (!body?.url || typeof body?.url !== "string") {
      return res.status(400).send("youtube url is required.");
    };

    const clientIp = getClientIp(req);
    if (!clientIp) {
      return res.status(403).send("unable to fetch client ip for identification. try again later.");
    };

    const captchaToken = String(req?.headers?.["x-recaptcha-token"]);
    if (process.env.NODE_ENV !== "development") {
      if (!captchaToken?.length) {
        return res.status(403).send("reCAPTCHA token is mandatory.");
      };

      const endpoint = new URL("https://www.google.com/recaptcha/api/siteverify");

      const secretKey = process.env.RECAPTCHA_KEY;
      if (typeof secretKey !== "string" || !secretKey?.length) {
        return res.status(500).send("unable to retrieve reCAPTCHA key from our ends.");
      };

      endpoint.searchParams.append("secret", secretKey);
      endpoint.searchParams.append("response", captchaToken);
      endpoint.searchParams.append("remoteip", clientIp);

      interface GoogleReCAPTCHASiteResponse extends Record<"action" | "hostname" | "challenge_ts", string> {
        success: boolean;
        score: number;
        error_codes: string[];
      };

      const request = await fetch(endpoint.toString(), {
        method: "GET"
      });

      if (request.status !== 200) {
        console.error(await request.text());
        return res.status(500).send(`unable to verify reCAPTCHA session from our end. [${request.status}]`);
      };

      const json = await request.json() as GoogleReCAPTCHASiteResponse;
      if (!json.success) {
        if (Array.isArray(json?.error_codes) && json?.error_codes.length) {
          console.error(json.error_codes);
        };

        return res.status(500).send("unable to verify reCAPTCHA session from our end.")
      };

      if (json.score < projectConfig.humanScoreThreshold) {
        return res.status(403).send("i don't think that you're a human enough to use this website.");
      };
    };

    const userSessionKey = `user_session-${clientIp}`;
    const userSession = await redis.hmget<Record<"tries" | "lastReset", number>>(`user_session-${clientIp}`, "tries", "lastReset");
    if (userSession !== null) {
      if (
        (typeof userSession.lastReset === "number" && typeof userSession.tries === "number") &&
        (userSession.tries >= projectConfig.userRetries && (Date.now() - userSession.lastReset) <= projectConfig.sessionExpiration) 
      ) {
        return res.status(429).send("you are currently rate limited. try again later.");
      };

      if (typeof userSession?.lastReset === "number" && ((Date.now() - userSession.lastReset) > projectConfig.sessionExpiration)) {
        await redis.hmset(userSessionKey, {
          tries: 0,
          lastReset: Date.now()
        });
      };
    };
  
    // { ..., duration: [0, 60] }
    if (!body?.duration || !Array.isArray(body.duration) || body.duration.length !== 2) {
      return res.status(400).send("duration is required.");
    };
  
    let [minSecond, maxSecond] = body.duration;
    if (isNaN(minSecond) || isNaN(maxSecond)) {
      return res.status(400).send("invalid duration.");
    };
  
    if (minSecond >= maxSecond) {
      minSecond = Math.max(0, maxSecond - 1);
    } else if (maxSecond <= minSecond) {
      maxSecond = Math.max(0, minSecond + 1);
    };

    if (process.env.NODE_ENV !== "development" && ((maxSecond - minSecond) >= projectConfig.maxClippingDurationInSecs)) {
      return res.status(413).send(`public domain only allowed to clip video up to ${projectConfig.maxClippingDurationInSecs} seconds.`);
    };

    // validate if the url from the body is youtube url
    if (!validateURL(body.url)) {
      return res.status(400).send("invalid youtube url.");
    };

    // retrieve youtube video from temp, or store a new one
    const videoId = getVideoID(body.url);
    if (!videoId?.length) {
      return res.status(400).send("invalid video id after parse.");
    };

    const bucketName = process.env.YT_TRIMMER_AWS_S3_NAME;
    if (!bucketName?.length) {
      return res.status(500).send("couldn't get aws bucket name from the end.");
    };

    const cookie = process.env.COOKIE_BYPASS;
    const ytdlConfig: getInfoOptions = (typeof cookie === "string" && cookie.length >= 1) ? {
      requestOptions: {
        headers: {
          // used to bypass age-restricted video, etc
          cookie
        }
      }
    } : {};

    // retrieving youtube content info
    const data = await getInfo(body.url, ytdlConfig);
    if (!data) {
      return res.status(500).send("unable to fetch the data of the current youtube url.");
    };

    const firstRawVideoURL = findAppropriateVideoFormat(data.formats, body?.quality);
    if (!firstRawVideoURL?.video?.url?.length || !firstRawVideoURL?.video?.mimeType?.length) {
      return res.status(500).send("unable to fetch video after filter.");
    };

    if (!firstRawVideoURL?.video?.approxDurationMs?.length) {
      return res.status(500).send("the current youtube video has no duration to check.");
    };

    // resetting the duration
    const maxVideoDurationSecond = Math.round(+firstRawVideoURL.video.approxDurationMs / 1000);

    // limitation
    if (process.env.npm_lifecycle_event === "start" && maxVideoDurationSecond >= Math.round(ms(`${projectConfig.maxVideoDurationNumberInMins}m`) / 1000)) {
      return res.status(413).send(`max youtube video duration is limited to ${projectConfig.maxVideoDurationNumberInMins} minutes. you can self host the project if you want to increase the limit.`);
    };

    if (maxSecond >= maxVideoDurationSecond) {
      maxSecond = maxVideoDurationSecond;
    };

    if (minSecond >= maxSecond) {
      minSecond = Math.max(0, maxSecond - 1);
    };

    // find videos on temp
    const baseUrlTempVideoPath: string = `temp_videos/${videoId}/${videoId}.mp4`;
    const baseUrlTempAudioPath: string = `temp_videos/${videoId}/${videoId}.webm`;

    try {
      const obj: Omit<HeadObjectCommandInput, "Key"> = {
        Bucket: bucketName
      };

      await Promise.all([
        S3Client.send(new HeadObjectCommand({ ...obj, Key: baseUrlTempVideoPath })),
        S3Client.send(new HeadObjectCommand({ ...obj, Key: baseUrlTempAudioPath }))
      ]);
    } catch {
      const invokeCommand = new InvokeCommand({
        FunctionName: process.env.YT_TRIMMER_LAMBDA_FUNC_NAME,
        Payload: JSON.stringify({
          // video
          videoUrl: firstRawVideoURL.video.url, videoId,

          // audio
          audioUrl: firstRawVideoURL?.audio?.url || null
        })
      });

      const command = await LambdaClient.send(invokeCommand);

      try {
        const rawPayload = command.Payload?.transformToString("utf-8");
        if (!rawPayload?.length) {
          return res.status(500).send("unable to parse payload after invocation.");
        };

        const payload = JSON.parse(rawPayload);

        if (
          ("statusCode" in payload && payload.statusCode !== 200) ||
          ("errorMessage" in payload)
        ) {
          if (process.env.NODE_ENV === "development") {
            console.error(payload);
          };

          return res.status(500).send("something went wrong.");
        };
      } catch {};

      if (command.$metadata.httpStatusCode !== 200 || command.StatusCode !== 200) {
        return res.status(500).send("something went wrong.");
      };
    };

    const folderName = uuidv4();
    const fileName = `${Date.now()}`;
    const combinedFileName = `transcoded/${folderName}/${fileName}`;

    const jobConfig = new CreateJobCommand({
      Role: process.env.YT_TRIMMER_AWS_ROLE,

      Settings: {
        TimecodeConfig: {
          Source: "ZEROBASED"
        },

        Inputs: [
          {
            InputClippings: [
              {
                StartTimecode: secondsToColonNotation(minSecond, firstRawVideoURL?.video?.fps),
                EndTimecode: secondsToColonNotation(maxSecond, firstRawVideoURL?.video?.fps)
              }
            ],

            TimecodeSource: "ZEROBASED",
            FileInput: `s3://${bucketName}/${baseUrlTempVideoPath}`,
            AudioSelectors: {
              "Audio Selector 1": {
                DefaultSelection: "DEFAULT",

                // so ugly
                ExternalAudioFileInput: firstRawVideoURL?.audio !== null ? `s3://${bucketName}/${baseUrlTempAudioPath}` : undefined
              }
            }
          }
        ],

        OutputGroups: [{
          Name: "File Group",

          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: `s3://${bucketName}/${combinedFileName}`
            }
          },

          Outputs: [{
            Extension: "mp4",

            AudioDescriptions: [{
              AudioSourceName: "Audio Selector 1",
              CodecSettings: {
                Codec: "AAC",
                AacSettings: {
                  Bitrate: +(firstRawVideoURL?.video?.audioBitrate || firstRawVideoURL?.audio?.audioBitrate || 128) * 1000,
                  CodingMode: "CODING_MODE_2_0",
                  SampleRate: +(firstRawVideoURL?.video?.audioSampleRate || firstRawVideoURL?.audio?.audioBitrate || 44100)
                }
              }
            }],

            VideoDescription: {
              CodecSettings: {
                Codec: "H_264",
                H264Settings: {
                  FramerateNumerator: Math.round(firstRawVideoURL?.video?.fps || 30),
                  FramerateDenominator: 1,
                  RateControlMode: "VBR",
                  Bitrate: firstRawVideoURL?.video?.bitrate || 5e+6
                }
              }
            },

            ContainerSettings: {
              Container: "MP4",
              Mp4Settings: {}
            }
          }],
        }]
      }
    })

    const transcodeRequest = await MediaConvertClient.send(jobConfig);
    if (typeof transcodeRequest.$metadata?.httpStatusCode === 'number' && transcodeRequest?.$metadata?.httpStatusCode >= 400) {
      return res.status(500).send(`an error occurred when trying to transcode. ${transcodeRequest.$metadata?.httpStatusCode || 0} / ${transcodeRequest.$metadata?.requestId || "?"}`);
    };
    
    if (!transcodeRequest?.Job?.Id?.length) {
      return res.status(500).send("no job id presented after transcode request.");
    };

    res.setHeader("content-type", "text/plain").send(transcodeRequest.Job.Id);

    await redis.hincrby(userSessionKey, "tries", 1);

    return;
  } catch (error) {
    console.error(error);

    return res.status(500).send("something went wrong from the backend.");
  };
};