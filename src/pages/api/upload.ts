import type { NextApiRequest, NextApiResponse } from 'next';
import { getInfo, validateURL, type getInfoOptions, getVideoID } from 'ytdl-core';
import ms from "ms";
import { v4 as uuidv4 } from "uuid";

// aws import
import { CreateJobCommand } from '@aws-sdk/client-mediaconvert';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { InvokeCommand } from "@aws-sdk/client-lambda";

// aws client import
import S3Client from '@/components/amazon-client/S3';
import MediaConvertClient from "@/components/amazon-client/MediaConvert";
import LambdaClient from '@/components/amazon-client/Lambda';

// utilities
import secondsToColonNotation from '@/components/hooks/secondsToColonNotation';
import findAppropriateVideoFormat from "@/components/hooks/findAppropriateVideoFormat";

// setup
const maxVideoDurationNumberInMins = 30;
const maxClippingDurationInSecs = 60;

export const config = {
  maxDuration: 60
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req?.method !== "POST") {
      return res.status(400).send("invalid request method.");
    };

    const body = req.body;
    if (!body?.url || typeof body?.url !== "string") {
      return res.status(400).send("youtube url is required.");
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

    if (process.env.NODE_ENV !== "development" && ((maxSecond - minSecond) >= maxClippingDurationInSecs)) {
      return res.status(413).send(`public domain only allowed to clip video up to ${maxClippingDurationInSecs} seconds.`);
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

    const firstRawVideoURL = findAppropriateVideoFormat(data.formats);
    if (!firstRawVideoURL?.url?.length || !firstRawVideoURL?.mimeType?.length) {
      return res.status(500).send("unable to fetch video after filter.");
    };

    if (!firstRawVideoURL?.approxDurationMs?.length) {
      return res.status(500).send("the current youtube video has no duration to check.");
    };

    // resetting the duration
    const maxVideoDurationSecond = Math.round(+firstRawVideoURL.approxDurationMs / 1000);

    // limitation
    if (process.env.npm_lifecycle_event === "start" && maxVideoDurationSecond >= Math.round(ms(`${maxVideoDurationNumberInMins}m`) / 1000)) {
      return res.status(413).send(`max youtube video duration is limited to ${maxVideoDurationNumberInMins} minutes. you can self host the project if you want to increase the limit.`);
    };

    if (maxSecond >= maxVideoDurationSecond) {
      maxSecond = maxVideoDurationSecond;
    };

    if (minSecond >= maxSecond) {
      minSecond = Math.max(0, maxSecond - 1);
    };

    // find videos on temp
    const baseUrlTempVideoPath: string = `temp_videos/${videoId}/${videoId}.mp4`;

    try {
      const videoTempFindCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: baseUrlTempVideoPath
      });

      await S3Client.send(videoTempFindCommand);
    } catch {
      const invokeCommand = new InvokeCommand({
        FunctionName: process.env.YT_TRIMMER_LAMBDA_FUNC_NAME,
        Payload: JSON.stringify({
          videoUrl: firstRawVideoURL.url, videoId
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
                StartTimecode: secondsToColonNotation(minSecond, firstRawVideoURL?.fps),
                EndTimecode: secondsToColonNotation(maxSecond, firstRawVideoURL?.fps)
              }
            ],

            TimecodeSource: "ZEROBASED",
            FileInput: `s3://${bucketName}/${baseUrlTempVideoPath}`,
            AudioSelectors: {
              "Audio Selector 1": {
                DefaultSelection: "DEFAULT"
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
                  Bitrate: +(firstRawVideoURL?.audioBitrate || 128) * 1000,
                  CodingMode: "CODING_MODE_2_0",
                  SampleRate: +(firstRawVideoURL?.audioSampleRate || 44100)
                }
              }
            }],

            VideoDescription: {
              CodecSettings: {
                Codec: "H_264",
                H264Settings: {
                  FramerateNumerator: Math.round(firstRawVideoURL?.fps || 30),
                  FramerateDenominator: 1,
                  RateControlMode: "VBR",
                  Bitrate: firstRawVideoURL?.bitrate || 5e+6
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

    return res.setHeader("content-type", "text/plain").send(transcodeRequest.Job.Id);
  } catch (error) {
    console.error(error);

    return res.status(500).send("something went wrong from the backend.");
  };
};