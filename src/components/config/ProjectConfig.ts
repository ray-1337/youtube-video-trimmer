import ms from "ms";

export default {
  // how many times user can trim videos at the range of time
  userRetries: 4,

  // range of time; lets say 2 minutes, then users can only trim like 3 clips in between 2 minutes, otherwise they have to wait for the next 2 minutes
  sessionExpiration: ms("2m"),

  // max video duration from youtube
  maxVideoDurationNumberInMins: 30,

  // maximum range time of users can clip the video
  maxClippingDurationInSecs: 60,

  // recaptcha
  humanScoreThreshold: 0.5,
};