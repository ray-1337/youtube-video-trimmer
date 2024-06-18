import { LambdaClient } from "@aws-sdk/client-lambda";
import config from "../config/BaseAWSClientConfig";

export default new LambdaClient(config);