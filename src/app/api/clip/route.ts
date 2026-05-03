import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { cutClip, cutClipWithSubtitles, ensureTmpDir } from "@/lib/ffmpeg";
import { generateSRT } from "@/lib/openai";
import { TranscriptSegment, VideoClip } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { filePath, clip, transcript, withSubtitles } = await req.json() as {
      filePath: string;
      clip: VideoClip;
      transcript: TranscriptSegment[];
      withSubtitles: boolean;
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

    if (withSubtitles && transcript && transcript.length > 0) {
      const srtContent = generateSRT(transcript, clip.startTime, clip.endTime);
      const srtDir = ensureTmpDir("srt");
      const srtPath = path.join(srtDir, `${clipId}.srt`);
      fs.writeFileSync(srtPath, srtContent, "utf-8");

      try {
        await cutClipWithSubtitles(filePath, outputPath, clip.startTime, duration, srtPath);
      } catch {
        // Fallback without subtitles if subtitle burning fails
        await cutClip(filePath, outputPath, clip.startTime, duration);
      } finally {
        try { fs.unlinkSync(srtPath); } catch {}
      }
    } else {
      await cutClip(filePath, outputPath, clip.startTime, duration);
    }

    // Read the file and return as base64 for download
    const fileBuffer = fs.readFileSync(outputPath);
    const base64 = fileBuffer.toString("base64");
    const fileSize = fs.statSync(outputPath).size;

    // Cleanup clip file after reading
    try { fs.unlinkSync(outputPath); } catch {}

    return NextResponse.json({
      clipId,
      base64,
      fileSize,
      mimeType: "video/mp4",
      fileName: `${clip.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}.mp4`,
    });
  } catch (err: any) {
    console.error("Clip error:", err);
    return NextResponse.json({ error: err.message || "Erro ao gerar clipe." }, { status: 500 });
  }
}
