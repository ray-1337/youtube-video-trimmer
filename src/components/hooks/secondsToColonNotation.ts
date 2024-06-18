export default function secondsToColonNotation(d: number, fps: number = 24) {
  const pad2 = (txt: number) => ('0' + Math.floor(txt)).slice(-2),
    h = pad2(d / 3600),
    m = pad2(d % 3600 / 60),
    s = pad2(d % 60),
    f = pad2(d % 1 * fps);

  return `${h}:${m}:${s}:${f}`;
};

// adapted from:
// https://stackoverflow.com/questions/42089868/converting-time-in-seconds-to-hhmmssff