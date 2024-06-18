export default {
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.YT_TRIMMER_AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.YT_TRIMMER_AWS_AUTH as string
  }
};