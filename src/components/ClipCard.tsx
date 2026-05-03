"use client";

import { useState, useRef } from "react";
import {
  Loader2,
  Scissors,
  Download,
  Star,
  Hash,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  X,
} from "lucide-react";
import { VideoClip, TranscriptSegment } from "@/types";
import { cn } from "@/lib/utils";

type VideoFormat = "9:16" | "16:9";

interface ClipCardProps {
  clip: VideoClip;
  filePath: string;
  transcript: TranscriptSegment[];
  index: number;
}

export default function ClipCard({ clip, filePath, transcript, index }: ClipCardProps) {
  const [loading, setLoading] = useState(false);
  const [withSubtitles, setWithSubtitles] = useState(true);
  const [format, setFormat] = useState<VideoFormat>("16:9");
  const [overlayBase64, setOverlayBase64] = useState<string | null>(null);
  const [overlayName, setOverlayName] = useState<string>("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix, keep only base64
      setOverlayBase64(result.split(",")[1]);
      setOverlayName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath,
          clip,
          transcript,
          withSubtitles,
          format,
          overlayBase64,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar clipe");

      // Trigger download from base64
      const byteChars = atob(data.base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNums);
      const blob = new Blob([byteArray], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor =
    clip.viralScore >= 8
      ? "text-green-400"
      : clip.viralScore >= 5
      ? "text-yellow-400"
      : "text-red-400";

  const scoreBg =
    clip.viralScore >= 8
      ? "bg-green-400/10 border-green-400/30"
      : clip.viralScore >= 5
      ? "bg-yellow-400/10 border-yellow-400/30"
      : "bg-red-400/10 border-red-400/30";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-violet-400 text-sm font-bold">{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-base leading-tight truncate">
                {clip.title}
              </h3>
              <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{clip.description}</p>
            </div>
          </div>

          {/* Viral Score */}
          <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border shrink-0", scoreBg)}>
            <Star size={13} className={scoreColor} />
            <span className={cn("text-sm font-bold", scoreColor)}>{clip.viralScore}/10</span>
          </div>
        </div>

        {/* Time info */}
        <div className="flex items-center gap-4 mt-4 text-sm text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Scissors size={13} />
            {formatTime(clip.startTime)} → {formatTime(clip.endTime)}
          </span>
          <span className="text-zinc-600">•</span>
          <span>{Math.round(clip.duration)}s</span>
        </div>

        {/* Hashtags */}
        {clip.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {clip.hashtags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg"
              >
                <Hash size={10} />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Transcript preview */}
      {transcript.length > 0 && (
        <div className="border-t border-zinc-800">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <span>Ver transcrição do trecho</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expanded && (
            <div className="px-5 pb-4 max-h-40 overflow-y-auto">
              <p className="text-zinc-400 text-sm leading-relaxed">
                {transcript
                  .filter((s) => s.start >= clip.startTime - 1 && s.end <= clip.endTime + 1)
                  .map((s) => s.text)
                  .join(" ")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Options */}
      <div className="border-t border-zinc-800 px-5 py-4 space-y-3">

        {/* Format selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-16 shrink-0">Formato</span>
          <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-xs">
            <button
              onClick={() => setFormat("16:9")}
              className={cn(
                "px-3 py-1.5 font-medium transition-colors",
                format === "16:9"
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              )}
            >
              16:9 Paisagem
            </button>
            <button
              onClick={() => setFormat("9:16")}
              className={cn(
                "px-3 py-1.5 font-medium transition-colors",
                format === "9:16"
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              )}
            >
              9:16 Stories
            </button>
          </div>
        </div>

        {/* Subtitles toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-16 shrink-0">Legendas</span>
          <button
            onClick={() => setWithSubtitles(!withSubtitles)}
            className={cn(
              "w-9 h-5 rounded-full transition-colors relative shrink-0",
              withSubtitles ? "bg-violet-600" : "bg-zinc-700"
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                withSubtitles ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </button>
          <span className="text-xs text-zinc-500">{withSubtitles ? "Ativadas" : "Desativadas"}</span>
        </div>

        {/* Overlay upload */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-16 shrink-0">Faixa/Logo</span>
          <input
            ref={overlayInputRef}
            type="file"
            accept="image/png,image/webp"
            className="hidden"
            onChange={handleOverlayUpload}
          />
          {overlayBase64 ? (
            <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300">
              <ImageIcon size={12} className="text-violet-400" />
              <span className="truncate max-w-[140px]">{overlayName}</span>
              <button
                onClick={() => { setOverlayBase64(null); setOverlayName(""); }}
                className="text-zinc-500 hover:text-red-400 transition-colors ml-1"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => overlayInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-violet-400 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors border border-zinc-700"
            >
              <ImageIcon size={12} />
              Adicionar PNG
            </button>
          )}
        </div>
      </div>

      {/* Generate button */}
      <div className="border-t border-zinc-800 px-5 py-4">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Gerando clipe...
            </>
          ) : (
            <>
              <Download size={16} />
              Gerar e Baixar ({format})
            </>
          )}
        </button>

        {error && (
          <p className="text-red-400 text-xs mt-2 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
