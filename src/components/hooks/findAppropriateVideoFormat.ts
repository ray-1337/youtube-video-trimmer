import type { videoFormat } from "ytdl-core";

export default function findAppropriateVideoFormat(formats: videoFormat[]): videoFormat | null {
  const liteFilteredFormats = formats.filter(format => format.hasAudio && format.hasVideo && !format.isLive && !format.isHLS);

  // the highest quality you can get (video w/ audio) is hd720, maybe there will be a workaround in the future
  const filteredFormats = liteFilteredFormats.filter(format => format.quality === "medium" || format.quality === "hd720");

  let highestFormat = filteredFormats.find(format => format.quality === "hd720");

  if (!highestFormat) {
    const lowest = filteredFormats.find(format => format.quality === "medium");
    if (!lowest) {
      return null;
    };

    highestFormat = lowest;
  };

  return highestFormat;
};