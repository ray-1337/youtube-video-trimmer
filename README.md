# YouTube Video Trimmer
This is a public GitHub repository of my personal project, YouTube Trimmer.

## Motive
There were funny memes that I want to clip on YouTube, but I don't have time to download bazillion gigabytes of YouTube video file, opening my Premiere Pro just trim these out. It's wasting time, and my hard drive. <br/>

I also found that developers also made this before, but it's not user-friendly, somes are unmaintained, confusing, somes going through the CLI/command line; and I really have no energy to do like the installation and stuff like that.

## Dependencies (and/or, Tools)
Mainly I use [Next.js](https://nextjs.org) and [React](https://react.dev) for the website, and [AWS Elemental MediaConvert](https://aws.amazon.com/mediaconvert/) for the video processing.

## How this works?
The YouTube video content will be pulled and temporarily stored in my S3 storage for processing. Then, the video will be processed using AWS Elemental MediaConvert.

I have to store it in my S3 storage because MediaConvert doesn't support [full-length URLs with parameters](https://docs.aws.amazon.com/mediaconvert/latest/ug/http-input-requirements.html). I was frustrated when I discovered this, but I had no choice but to take this route.

It's a bit complicated to explain the full scope of this project, especially for someone who unfamiliar with AWS, but that's the basic idea.

To save on costs, the transcoded video will be stored in my S3 storage for about an hour, while the temporary YouTube video will be stored for a day.

## Limitations
- Live-streaming video
  - There's no way I can pull off a video while live-streaming.
- Precision
  - The timing here isn't very precise, even though you can add a decimal at the end of the number.
    - You can trim it later with your chosen video editor.

## Project License
Please see [LICENSE](LICENSE) for more information about this project license.