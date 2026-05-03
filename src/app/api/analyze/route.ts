import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getVideoDuration, extractAudio, ensureTmpDir } from "@/lib/ffmpeg";
import { transcribeAudio, analyzeForViralClips } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const tmpFiles: string[] = [];

  try {
    const { videoId, filePath } = await req.json();

    if (!videoId || !filePath) {
      return NextResponse.json({ error: "videoId e filePath são obrigatórios." }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Arquivo de vídeo não encontrado." }, { status: 404 });
    }

    // 1. Get video duration
    const duration = await getVideoDuration(filePath);

    if (duration < 60) {
      return NextResponse.json(
        {
          error: "Vídeo muito curto para análise viral. O vídeo precisa ter pelo menos 1 minuto.",
          duration,
        },
        { status: 400 }
      );
    }

    // 2. Extract audio for transcription
    const audioDir = ensureTmpDir("audio");
    const audioPath = path.join(audioDir, `${uuidv4()}.wav`);
    tmpFiles.push(audioPath);

    await extractAudio(filePath, audioPath);

    // 3. Transcribe with Whisper
    const transcript = await transcribeAudio(audioPath);

    if (transcript.length === 0) {
      return NextResponse.json(
        { error: "Não foi possível transcrever o áudio. Verifique se o vídeo tem fala." },
        { status: 400 }
      );
    }

    // 4. Analyze with GPT-4o to find viral clips
    const clips = await analyzeForViralClips(transcript, duration);

    // Cleanup audio
    tmpFiles.forEach((f) => {
      try { fs.unlinkSync(f); } catch {}
    });

    return NextResponse.json({
      videoId,
      filePath,
      videoDuration: duration,
      transcript,
      clips,
    });
  } catch (err: any) {
    console.error("Analyze error:", err);
    tmpFiles.forEach((f) => {
      try { fs.unlinkSync(f); } catch {}
    });
    return NextResponse.json(
      { error: err.message || "Erro ao analisar o vídeo." },
      { status: 500 }
    );
  }
}
