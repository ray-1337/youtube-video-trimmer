import { MediaConvertClient } from "@aws-sdk/client-mediaconvert";
import config from "../config/BaseAWSClientConfig";

export default new MediaConvertClient(config);