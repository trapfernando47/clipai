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

export type VideoFormat = "9:16" | "16:9";

function getScaleFilter(format: VideoFormat): string {
  if (format === "16:9") {
    return "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black";
  }
  // 9:16 vertical (default)
  return "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black";
}

export function cutClip(
  videoPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  format: VideoFormat = "9:16"
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-vf", getScaleFilter(format),
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
  srtPath: string,
  format: VideoFormat = "9:16"
): Promise<void> {
  return new Promise((resolve, reject) => {
    const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    const scaleFilter = getScaleFilter(format);
    const fontSize = format === "16:9" ? "22" : "18";

    ffmpeg(videoPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-vf",
        `${scaleFilter},subtitles='${escapedSrt}':force_style='FontSize=${fontSize},FontName=Arial,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2'`,
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

export function cutClipWithOverlay(
  videoPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  overlayPath: string,
  format: VideoFormat = "16:9"
): Promise<void> {
  return new Promise((resolve, reject) => {
    const scaleFilter = getScaleFilter(format);
    // Position overlay at bottom (y=H-h-20) for 16:9, or center-bottom for 9:16
    const overlayPos = format === "16:9" ? "0:H-h-20" : "(W-w)/2:H-h-40";

    ffmpeg(videoPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .input(overlayPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-filter_complex",
        `[0:v]${scaleFilter}[base];[base][1:v]overlay=${overlayPos}`,
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

export function cutClipWithOverlayAndSubtitles(
  videoPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  overlayPath: string,
  srtPath: string,
  format: VideoFormat = "16:9"
): Promise<void> {
  return new Promise((resolve, reject) => {
    const scaleFilter = getScaleFilter(format);
    const overlayPos = format === "16:9" ? "0:H-h-20" : "(W-w)/2:H-h-40";
    const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    const fontSize = format === "16:9" ? "22" : "18";

    ffmpeg(videoPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .input(overlayPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-filter_complex",
        `[0:v]${scaleFilter}[base];[base][1:v]overlay=${overlayPos}[overlaid];[overlaid]subtitles='${escapedSrt}':force_style='FontSize=${fontSize},FontName=Arial,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2'`,
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
