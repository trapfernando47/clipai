"use client";

import { useState } from "react";
import { Loader2, Sparkles, AlertCircle, Clock } from "lucide-react";
import { AnalysisResult } from "@/types";

interface AnalyzeButtonProps {
  videoId: string;
  filePath: string;
  onResult: (result: AnalysisResult) => void;
}

export default function AnalyzeButton({ videoId, filePath, onResult }: AnalyzeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("");

  const steps = [
    "Extraindo áudio do vídeo...",
    "Transcrevendo com Whisper AI...",
    "Analisando momentos virais com GPT-4o...",
    "Finalizando análise...",
  ];

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");

    // Simulate step progression
    let stepIndex = 0;
    setStep(steps[0]);
    const interval = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, steps.length - 1);
      setStep(steps[stepIndex]);
    }, 8000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, filePath }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na análise");

      onResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
      setStep("");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl text-lg font-semibold transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
      >
        {loading ? (
          <Loader2 className="animate-spin" size={22} />
        ) : (
          <Sparkles size={22} />
        )}
        {loading ? "Analisando..." : "Analisar e Encontrar Clipes Virais"}
      </button>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Clock size={14} className="animate-pulse" />
          <span>{step}</span>
        </div>
      )}

      {!loading && (
        <p className="text-zinc-500 text-sm text-center max-w-md">
          A IA vai transcrever o vídeo, identificar os melhores momentos e gerar sugestões de clipes virais prontos para download.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 max-w-md w-full">
          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
