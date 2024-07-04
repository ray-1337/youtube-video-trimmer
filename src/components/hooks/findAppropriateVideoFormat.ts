import type { videoFormat } from "ytdl-core";

interface AppropriateContentFormatResult {
  video: videoFormat;
  audio: videoFormat | null;
};

export default function findAppropriateContentFormat(formats: videoFormat[], quality: string = "medium"): AppropriateContentFormatResult | null {
  switch (quality.toLowerCase()) {
    // highest format possible, sorted by bitrate
    case "highest": {
      // highest video filter
      const highestVideoForm = formats
      .filter(val => (val.hasVideo === true && val.hasAudio === false))
      .sort((a, b) => (b?.bitrate || 0) - (a?.bitrate || 0));

      const highestVideo = highestVideoForm?.[0];

      if (!highestVideoForm?.length || !highestVideo) {
        return null;
      };

      // highest audio filter, sorted by bitrate, webm/opus needed
      const highestAudioForm = formats
      .filter(val => (val.hasVideo === false && val.hasAudio === true && val.codecs === "opus"))
      .sort((a, b) => (b?.bitrate || 0) - (a?.bitrate || 0));

      const highestAudio = highestAudioForm?.[0];

      if (!highestAudioForm?.length || !highestAudio) {
        return null;
      };

      return {
        video: highestVideo,
        audio: highestAudio
      };
    };

    // medium/auto quality
    case "medium": {
      const liteFilteredFormats = formats.filter(format => format.hasAudio && format.hasVideo && !format.isLive && !format.isHLS);
      const filteredFormats = liteFilteredFormats.filter(format => format.quality === "medium" || format.quality === "hd720");

      let highestFormat = filteredFormats.find(format => format.quality === "hd720");

      if (!highestFormat) {
        const lowest = filteredFormats.find(format => format.quality === "medium");
        if (!lowest) {
          return null;
        };

        highestFormat = lowest;
      };

      return {
        video: highestFormat,
        audio: null
      };
    };

    default: {
      return null;
    };
  };
};