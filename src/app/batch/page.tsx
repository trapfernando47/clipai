"use client";

import { useState, useRef } from "react";
import { FolderOpen, Loader2, Sparkles, AlertCircle, CheckCircle2, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Platform = "instagram" | "tiktok" | "both";
type VideoFormat = "9:16" | "16:9";

interface BatchResult {
  file: string;
  status: "done" | "error" | "skipped";
  reason?: string;
  clips?: { title: string; viralScore: number; scheduledAt: string }[];
}

export default function BatchPage() {
  const [folderPath, setFolderPath] = useState("");
  const [platform, setPlatform] = useState<Platform>("both");
  const [format, setFormat] = useState<VideoFormat>("16:9");
  const [overlayBase64, setOverlayBase64] = useState<string | null>(null);
  const [overlayName, setOverlayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLInputElement>(null);

  const handleOverlay = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setOverlayBase64((reader.result as string).split(",")[1]);
      setOverlayName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleProcess = async () => {
    if (!folderPath.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath, overlayBase64, format, platform }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no processamento");
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Processamento em Lote</h1>
          <p className="text-zinc-400 mt-2">
            Aponte para a pasta com os episódios baixados. A IA processa tudo, gera os clipes e agenda os posts automaticamente.
          </p>
        </div>

        {/* Config card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">

          {/* Folder path */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Caminho da pasta com os episódios</label>
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3">
                <FolderOpen size={16} className="text-zinc-500 shrink-0" />
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="Ex: C:\Users\perpl\Videos\Episodios"
                  className="flex-1 bg-transparent text-white placeholder-zinc-500 text-sm focus:outline-none"
                />
              </div>
            </div>
            <p className="text-zinc-600 text-xs mt-1.5">Suporta MP4, MKV, AVI, MOV, WebM</p>
          </div>

          {/* Format */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Formato de saída</label>
            <div className="flex rounded-xl overflow-hidden border border-zinc-700 w-fit">
              {(["16:9", "9:16"] as VideoFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "px-5 py-2.5 text-sm font-medium transition-colors",
                    format === f ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  {f === "16:9" ? "16:9 Paisagem" : "9:16 Stories"}
                </button>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Plataforma de publicação</label>
            <div className="flex rounded-xl overflow-hidden border border-zinc-700 w-fit">
              {([
                { value: "both", label: "Instagram + TikTok" },
                { value: "instagram", label: "Instagram" },
                { value: "tiktok", label: "TikTok" },
              ] as { value: Platform; label: string }[]).map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium transition-colors",
                    platform === p.value ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overlay */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">PNG da faixa/identidade visual</label>
            <input ref={overlayRef} type="file" accept="image/png,image/webp" className="hidden" onChange={handleOverlay} />
            {overlayBase64 ? (
              <div className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 w-fit">
                <ImageIcon size={15} className="text-violet-400" />
                <span className="text-sm text-zinc-300">{overlayName}</span>
                <button onClick={() => { setOverlayBase64(null); setOverlayName(""); }} className="text-zinc-500 hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => overlayRef.current?.click()}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-violet-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2.5 rounded-xl transition-colors"
              >
                <ImageIcon size={15} />
                Adicionar PNG padrão
              </button>
            )}
          </div>
        </div>

        {/* Process button */}
        <button
          onClick={handleProcess}
          disabled={loading || !folderPath.trim()}
          className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-lg font-semibold transition-all shadow-lg shadow-violet-500/20"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={22} />
              Processando episódios...
            </>
          ) : (
            <>
              <Sparkles size={22} />
              Processar Pasta e Agendar Posts
            </>
          )}
        </button>

        {loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
            <p className="text-zinc-300 text-sm font-medium">Processando...</p>
            {["Lendo arquivos da pasta", "Transcrevendo áudio com Whisper", "Analisando momentos virais com GPT-4o", "Gerando clipes com FFmpeg", "Agendando posts"].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 size={12} className="animate-spin text-violet-400" />
                {step}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Resultado</h2>
            {results.map((r, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  {r.status === "done" ? (
                    <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                  ) : r.status === "error" ? (
                    <AlertCircle size={18} className="text-red-400 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-zinc-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{r.file}</p>
                    {r.reason && <p className="text-zinc-500 text-xs mt-0.5">{r.reason}</p>}
                  </div>
                  {r.status === "done" && r.clips && (
                    <span className="text-xs text-violet-400 shrink-0">{r.clips.length} clipes agendados</span>
                  )}
                </div>
                {r.clips && r.clips.length > 0 && (
                  <div className="mt-3 space-y-1.5 pl-7">
                    {r.clips.map((c, j) => (
                      <div key={j} className="flex items-center justify-between text-xs text-zinc-400">
                        <span className="truncate max-w-[60%]">{c.title}</span>
                        <span className="text-zinc-600">{formatDate(c.scheduledAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
