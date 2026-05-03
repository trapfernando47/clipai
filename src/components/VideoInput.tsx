"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Link, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoInputProps {
  onVideoReady: (videoId: string, filePath: string) => void;
  disabled?: boolean;
}

export default function VideoInput({ onVideoReady, disabled }: VideoInputProps) {
  const [mode, setMode] = useState<"upload" | "youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setLoading(true);
      setError("");
      setProgress("Fazendo upload do vídeo...");

      try {
        const formData = new FormData();
        formData.append("video", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro no upload");

        setProgress("Upload concluído!");
        onVideoReady(data.videoId, data.filePath);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
        setProgress("");
      }
    },
    [onVideoReady]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".webm", ".mov", ".avi", ".mpeg"],
    },
    maxFiles: 1,
    disabled: loading || disabled,
  });

  const handleYouTube = async () => {
    if (!youtubeUrl.trim()) return;

    setLoading(true);
    setError("");
    setProgress("Baixando vídeo do YouTube...");

    try {
      const res = await fetch("/api/download-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao baixar vídeo");

      setProgress("Download concluído!");
      onVideoReady(data.videoId, data.filePath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Mode Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-zinc-700 mb-6">
        <button
          onClick={() => setMode("upload")}
          className={cn(
            "flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors",
            mode === "upload"
              ? "bg-violet-600 text-white"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          )}
        >
          <Upload size={16} />
          Upload de Arquivo
        </button>
        <button
          onClick={() => setMode("youtube")}
          className={cn(
            "flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors",
            mode === "youtube"
              ? "bg-violet-600 text-white"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          )}
        >
          <Link size={16} />
          Link do YouTube
        </button>
      </div>

      {/* Upload Mode */}
      {mode === "upload" && (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
            isDragActive
              ? "border-violet-500 bg-violet-500/10"
              : "border-zinc-700 hover:border-violet-500/50 hover:bg-zinc-800/50",
            (loading || disabled) && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-violet-400" size={40} />
              <p className="text-zinc-300">{progress}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Upload className="text-violet-400" size={28} />
              </div>
              <div>
                <p className="text-white font-medium">
                  {isDragActive ? "Solte o vídeo aqui" : "Arraste seu vídeo ou clique para selecionar"}
                </p>
                <p className="text-zinc-500 text-sm mt-1">MP4, WebM, MOV, AVI — máximo 500MB</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* YouTube Mode */}
      {mode === "youtube" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleYouTube()}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={loading || disabled}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleYouTube}
              disabled={loading || !youtubeUrl.trim() || disabled}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Link size={18} />}
              {loading ? "Baixando..." : "Baixar"}
            </button>
          </div>
          {loading && (
            <p className="text-zinc-400 text-sm text-center">{progress}</p>
          )}
          <p className="text-zinc-500 text-xs text-center">
            Requer yt-dlp instalado no servidor. Suporta YouTube, YouTube Shorts.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
