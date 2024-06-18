import { S3Client } from "@aws-sdk/client-s3";
import config from "../config/BaseAWSClientConfig";

export default new S3Client(config);