import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import {
  cutClip,
  cutClipWithSubtitles,
  cutClipWithOverlay,
  cutClipWithOverlayAndSubtitles,
  ensureTmpDir,
  VideoFormat,
} from "@/lib/ffmpeg";
import { generateSRT } from "@/lib/openai";
import { TranscriptSegment, VideoClip } from "@/types";

export async function POST(req: NextRequest) {
  const tmpFiles: string[] = [];

  try {
    const { filePath, clip, transcript, withSubtitles, format, overlayBase64 } =
      await req.json() as {
        filePath: string;
        clip: VideoClip;
        transcript: TranscriptSegment[];
        withSubtitles: boolean;
        format: VideoFormat;
        overlayBase64?: string;
      };

    if (!filePath || !clip) {
      return NextResponse.json({ error: "filePath e clip são obrigatórios." }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Arquivo de vídeo não encontrado." }, { status: 404 });
    }

    const clipsDir = ensureTmpDir("clips");
    const clipId = uuidv4();
    const outputPath = path.join(clipsDir, `${clipId}.mp4`);
    const duration = clip.endTime - clip.startTime;
    const videoFormat: VideoFormat = format || "9:16";

    // Save overlay PNG to tmp if provided
    let overlayPath: string | null = null;
    if (overlayBase64) {
      const overlayDir = ensureTmpDir("overlays");
      overlayPath = path.join(overlayDir, `${clipId}-overlay.png`);
      const overlayBuffer = Buffer.from(overlayBase64, "base64");
      fs.writeFileSync(overlayPath, overlayBuffer);
      tmpFiles.push(overlayPath);
    }

    // Build SRT if subtitles requested
    let srtPath: string | null = null;
    if (withSubtitles && transcript && transcript.length > 0) {
      const srtContent = generateSRT(transcript, clip.startTime, clip.endTime);
      const srtDir = ensureTmpDir("srt");
      srtPath = path.join(srtDir, `${clipId}.srt`);
      fs.writeFileSync(srtPath, srtContent, "utf-8");
      tmpFiles.push(srtPath);
    }

    // Pick the right ffmpeg function based on options
    try {
      if (overlayPath && srtPath) {
        await cutClipWithOverlayAndSubtitles(
          filePath, outputPath, clip.startTime, duration, overlayPath, srtPath, videoFormat
        );
      } else if (overlayPath) {
        await cutClipWithOverlay(
          filePath, outputPath, clip.startTime, duration, overlayPath, videoFormat
        );
      } else if (srtPath) {
        await cutClipWithSubtitles(
          filePath, outputPath, clip.startTime, duration, srtPath, videoFormat
        );
      } else {
        await cutClip(filePath, outputPath, clip.startTime, duration, videoFormat);
      }
    } catch {
      // Fallback: plain cut without subtitles/overlay
      await cutClip(filePath, outputPath, clip.startTime, duration, videoFormat);
    }

    // Read and return as base64
    const fileBuffer = fs.readFileSync(outputPath);
    const base64 = fileBuffer.toString("base64");
    const fileSize = fs.statSync(outputPath).size;

    tmpFiles.push(outputPath);
    tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch {} });

    return NextResponse.json({
      clipId,
      base64,
      fileSize,
      mimeType: "video/mp4",
      fileName: `${clip.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}_${videoFormat.replace(":", "x")}.mp4`,
    });
  } catch (err: any) {
    tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch {} });
    console.error("Clip error:", err);
    return NextResponse.json({ error: err.message || "Erro ao gerar clipe." }, { status: 500 });
  }
}
