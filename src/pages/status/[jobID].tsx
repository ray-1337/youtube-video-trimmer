import { type InferGetServerSidePropsType, type GetServerSidePropsContext } from "next";
import { type FC } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { Flex, Text, Alert, Anchor, type DefaultMantineColor, Paper } from "@mantine/core";
import { upperFirst } from "@mantine/hooks";
import ms from "ms";

import { GetJobCommand, type JobStatus } from "@aws-sdk/client-mediaconvert";
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import S3Client from "@/components/amazon-client/S3";
import MediaConvertClient from "@/components/amazon-client/MediaConvert";

const Footer = dynamic(() => import("@/components/ui/Footer"), { ssr: false });
const Title = dynamic(() => import("@/components/ui/Title"), { ssr: false });

type ExtendedJobStatus = JobStatus | "UNKNOWN";

const statusColor: Record<ExtendedJobStatus, DefaultMantineColor> = {
  ERROR: "red",
  CANCELED: "red",
  PROGRESSING: "yellow",
  SUBMITTED: "cyan",
  COMPLETE: "green",
  UNKNOWN: "gray"
};

import style from "@/styles/index.module.css";

const JobStatusPage: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (props) => {
  const router = useRouter();
  
  return (
    <section className={style.container}>
      <section className={style.insider}>
        <Flex direction={"column"} gap={"md"}>
          <Title />

          {/* error modal */}
          {
            ("errorText" in props) && (
              <Alert title={"Error"} variant={"filled"} color={"red"}>
                {props.errorText}
              </Alert>
            )
          }

          {/* information about the status job */}
          {
            (("statusJob" in props) && !["ERROR", "CANCELLED", "COMPLETE"].includes(props.statusJob)) && (
              <Alert title={"Information"} variant={"filled"} color={"blue"}>
                This acts the same as video editor, it takes time to transcode.

                Usually it takes 15-60 seconds to process for a YouTube video with 5-15 minutes of origin duration.

                You can reload the page to refresh the status.
              </Alert>
            )
          }

          {/* job id */}
          <Paper shadow={"md"} p={"md"}>
            <Flex direction={"column"} gap={"xl"}>
              <Text fw={"bold"}>Job ID</Text>

              <Text c={"dark"} size={"sm"}>
                # {router.query.jobID}
              </Text>
            </Flex>
          </Paper>

          {/* status */}
          {
            (("statusJob" in props)) && (
              <Paper shadow={"md"} p={"md"}>
                <Flex direction={"column"} gap={"xl"}>
                  <Text fw={"bold"}>Status</Text>

                  <Text c={props.statusJob === null ? "gray" : statusColor[props.statusJob as ExtendedJobStatus]} fw={"bold"} size={"sm"}>
                    {props.statusJob === null ? "Unknown" : upperFirst(props.statusJob)}
                  </Text>
                </Flex>
              </Paper>
            )
          }

          {/* final url */}
          {
            ("presignedUrl" in props && typeof props.presignedUrl === "string" && props.statusJob === "COMPLETE") && (
              <Paper shadow={"sm"} p={"md"} bd={"1px dashed black"}>
                <Flex justify={"space-between"} align={"center"} gap={"xl"}>
                  <Anchor href={props.presignedUrl} target="_blank">
                    Link Download (1 hour)
                  </Anchor>
                </Flex>
              </Paper>
            )
          }
        </Flex>

        <Footer />
      </section>
    </section>
  );
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const generateErrorText = (errorText: string) => {
    return {
      props: {
        errorText
      }
    };
  };

  const jobId = ctx.query?.jobID;
  if (typeof jobId !== "string" || !jobId?.length) {
    return generateErrorText("invalid job id.");
  };

  const command = new GetJobCommand({
    Id: jobId
  });

  const jobRequest = await MediaConvertClient.send(command);
  if (typeof jobRequest.$metadata?.httpStatusCode === 'number' && jobRequest?.$metadata?.httpStatusCode >= 400) {
    return generateErrorText(`an error occurred when trying to fetch job content. ${jobRequest.$metadata?.httpStatusCode || 0} / ${jobRequest.$metadata?.requestId || "?"}`)
  };

  if (!jobRequest?.Job?.Id) {
    return generateErrorText("invalid job id after request.");
  };

  const statusJob = jobRequest.Job?.Status || "UNKNOWN";
  const outputFileRawPath = jobRequest.Job.Settings?.OutputGroups?.[0]?.OutputGroupSettings?.FileGroupSettings?.Destination;
  const combinedFilePath = outputFileRawPath?.split("/").slice(3).join("/");
  if (!combinedFilePath?.length || typeof combinedFilePath !== "string") {
    return generateErrorText("invalid transcoded video path.");
  };

  let presignedUrl: string | null = null;

  const ext = "mp4";

  if (statusJob === "COMPLETE") {
    const s3Command = new GetObjectCommand({
      Bucket: process.env.YT_TRIMMER_AWS_S3_NAME as string,
      Key: `${combinedFilePath}.${ext}`
    });

    const url = await getSignedUrl(S3Client, s3Command, {
      expiresIn: Math.round(ms("1h") / 1000)
    });

    presignedUrl = url;
  };

  return {
    props: {
      statusJob, presignedUrl
    }
  };
};

export default JobStatusPage;