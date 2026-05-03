import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import os from "os";

// Set ffmpeg path — use system ffmpeg or ffmpeg-static fallback
function getFfmpegPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static");
    return ffmpegStatic as string;
  } catch {
    return "ffmpeg"; // rely on system PATH
  }
}

ffmpeg.setFfmpegPath(getFfmpegPath());

export const TMP_DIR = process.env.TMP_DIR || os.tmpdir();

export function ensureTmpDir(subdir?: string): string {
  const dir = subdir ? path.join(TMP_DIR, subdir) : TMP_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

export function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export function cutClip(
  videoPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
        "-preset", "fast",
        "-crf", "23",
        "-movflags", "+faststart",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export function cutClipWithSubtitles(
  videoPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  srtPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Escape path for ffmpeg filter
    const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

    ffmpeg(videoPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-vf",
        `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,subtitles='${escapedSrt}':force_style='FontSize=18,FontName=Arial,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2'`,
        "-preset", "fast",
        "-crf", "23",
        "-movflags", "+faststart",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export function cleanupFiles(paths: string[]): void {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // ignore cleanup errors
    }
  }
}
