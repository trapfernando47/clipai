import OpenAI from "openai";
import fs from "fs";
import { TranscriptSegment, VideoClip } from "@/types";

// Lazy singleton — avoids instantiation at build time when env vars are absent
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export async function transcribeAudio(audioPath: string): Promise<TranscriptSegment[]> {
  const openai = getOpenAI();
  const audioFile = fs.createReadStream(audioPath);

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const segments = (response as any).segments || [];

  return segments.map((seg: any) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }));
}

export async function analyzeForViralClips(
  transcript: TranscriptSegment[],
  videoDuration: number
): Promise<VideoClip[]> {
  const transcriptText = transcript
    .map((s) => `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`)
    .join("\n");

  const prompt = `Você é um especialista em criação de conteúdo viral para redes sociais (TikTok, Instagram Reels, YouTube Shorts).

Analise a transcrição abaixo de um vídeo de ${formatTime(videoDuration)} e identifique os 3 a 5 melhores momentos para criar clipes virais de 30 a 60 segundos.

TRANSCRIÇÃO:
${transcriptText}

Para cada clipe, retorne um JSON com:
- startTime: tempo de início em segundos (número)
- endTime: tempo de fim em segundos (número, máximo startTime + 60)
- title: título chamativo para o clipe (máximo 60 caracteres)
- description: descrição curta do por que esse momento é viral (máximo 120 caracteres)
- viralScore: pontuação de 1 a 10 do potencial viral
- hashtags: array com 5 hashtags relevantes (sem o #)

Critérios para selecionar momentos virais:
1. Momentos de insight ou revelação surpreendente
2. Histórias emocionantes ou engraçadas
3. Dicas práticas e acionáveis
4. Frases de impacto ou citações memoráveis
5. Momentos de tensão ou conflito
6. Começos que prendem atenção imediatamente

Retorne APENAS um array JSON válido, sem markdown, sem explicações.`;

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = response.choices[0].message.content || "[]";

  try {
    // Strip any markdown code blocks if present
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const clips = JSON.parse(cleaned);

    return clips.map((clip: any, index: number) => ({
      id: `clip-${index + 1}`,
      startTime: Number(clip.startTime),
      endTime: Math.min(Number(clip.endTime), Number(clip.startTime) + 60),
      duration: Math.min(Number(clip.endTime) - Number(clip.startTime), 60),
      title: clip.title || `Clipe ${index + 1}`,
      description: clip.description || "",
      viralScore: Number(clip.viralScore) || 5,
      hashtags: Array.isArray(clip.hashtags) ? clip.hashtags : [],
      status: "pending" as const,
    }));
  } catch {
    throw new Error("Falha ao parsear resposta da IA. Tente novamente.");
  }
}

export function generateSRT(
  segments: TranscriptSegment[],
  startOffset: number,
  endOffset: number
): string {
  const filtered = segments.filter(
    (s) => s.start >= startOffset && s.end <= endOffset + 1
  );

  return filtered
    .map((seg, i) => {
      const start = formatSRTTime(seg.start - startOffset);
      const end = formatSRTTime(Math.min(seg.end - startOffset, endOffset - startOffset));
      return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join("\n");
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}
