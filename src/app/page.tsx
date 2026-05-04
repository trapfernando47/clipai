"use client";

import { useState } from "react";
import VideoInput from "@/components/VideoInput";
import AnalyzeButton from "@/components/AnalyzeButton";
import ClipCard from "@/components/ClipCard";
import { AnalysisResult } from "@/types";
import { Zap, RotateCcw, Clock } from "lucide-react";

export default function Home() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [step, setStep] = useState<"input" | "analyze" | "results">("input");

  const handleVideoReady = (id: string, path: string) => {
    setVideoId(id);
    setFilePath(path);
    setStep("analyze");
  };

  const handleResult = (data: AnalysisResult) => {
    setResult(data);
    setStep("results");
  };

  const handleReset = () => {
    setVideoId(null);
    setFilePath(null);
    setResult(null);
    setStep("input");
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}m ${sec}s`;
  };

  return (
    <div className="bg-zinc-950 text-white">
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Reset button */}
        {step !== "input" && (
          <div className="flex justify-end mb-6">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <RotateCcw size={14} />
              Novo vídeo
            </button>
          </div>
        )}
        {/* Step: Input */}
        {step === "input" && (
          <div className="flex flex-col items-center gap-10">
            {/* Hero */}
            <div className="text-center max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-violet-400 text-sm mb-6">
                <Zap size={13} />
                Powered by GPT-4o + Whisper
              </div>
              <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                Transforme vídeos longos em{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">
                  clipes virais
                </span>
              </h2>
              <p className="text-zinc-400 text-lg">
                Faça upload de um vídeo ou cole um link do YouTube. A IA identifica os melhores momentos e gera clipes prontos para TikTok, Reels e Shorts.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
              {[
                { icon: "🎙️", title: "Transcrição automática", desc: "Whisper AI com alta precisão" },
                { icon: "🧠", title: "Análise inteligente", desc: "GPT-4o identifica momentos virais" },
                { icon: "✂️", title: "Corte preciso", desc: "FFmpeg com legendas automáticas" },
              ].map((f) => (
                <div key={f.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <p className="text-white text-sm font-medium">{f.title}</p>
                  <p className="text-zinc-500 text-xs mt-1">{f.desc}</p>
                </div>
              ))}
            </div>

            <VideoInput onVideoReady={handleVideoReady} />
          </div>
        )}

        {/* Step: Analyze */}
        {step === "analyze" && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Vídeo pronto para análise</h2>
              <p className="text-zinc-400">
                Clique no botão abaixo para a IA analisar e encontrar os melhores momentos virais.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                <Clock size={16} className="text-violet-400" />
                <span>Tempo estimado: 1-3 minutos dependendo do tamanho do vídeo</span>
              </div>
            </div>

            <AnalyzeButton
              videoId={videoId!}
              filePath={filePath!}
              onResult={handleResult}
            />
          </div>
        )}

        {/* Step: Results */}
        {step === "results" && result && (
          <div className="space-y-8">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {result.clips.length} clipes encontrados
                </h2>
                <p className="text-zinc-400 mt-1">
                  Vídeo de {formatDuration(result.videoDuration)} analisado com sucesso
                </p>
              </div>
              <div className="text-right text-sm text-zinc-500">
                {result.transcript.length} segmentos transcritos
              </div>
            </div>

            {/* Clips Grid */}
            <div className="grid gap-4">
              {result.clips
                .sort((a, b) => b.viralScore - a.viralScore)
                .map((clip, i) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    filePath={result.filePath as string}
                    transcript={result.transcript}
                    index={i}
                  />
                ))}
            </div>

            {/* Footer note */}
            <p className="text-center text-zinc-600 text-sm">
              Clique em "Gerar e Baixar" em cada clipe para processar e baixar o vídeo cortado.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
