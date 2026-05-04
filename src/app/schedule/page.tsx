"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Clock, CheckCircle2, AlertCircle, RefreshCw, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduledPost {
  id: string;
  title: string;
  description: string;
  hashtags: string;
  platform: string;
  scheduled_at: string;
  status: string;
  error?: string;
  episode_name?: string;
  instagram_post_id?: string;
  tiktok_post_id?: string;
}

export default function SchedulePage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?status=${filter}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, [filter]);

  const handleDelete = async (id: string) => {
    await fetch("/api/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchPosts();
  };

  const handlePublishNow = async () => {
    setPublishing(true);
    setMessage("");
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || "clipai-cron"}`,
        },
      });
      const data = await res.json();
      setMessage(`${data.published || 0} posts enviados para agendamento.`);
      fetchPosts();
    } catch (err: any) {
      setMessage("Erro ao publicar: " + err.message);
    }
    setPublishing(false);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const platformIcon = (platform: string) => {
    if (platform === "instagram") return "📸";
    if (platform === "tiktok") return "🎵";
    return "📸🎵";
  };

  const statusColor = (status: string) => {
    if (status === "done") return "text-green-400";
    if (status === "error") return "text-red-400";
    if (status === "publishing") return "text-yellow-400";
    return "text-zinc-400";
  };

  const statusIcon = (status: string) => {
    if (status === "done") return <CheckCircle2 size={15} className="text-green-400" />;
    if (status === "error") return <AlertCircle size={15} className="text-red-400" />;
    if (status === "publishing") return <Loader2 size={15} className="animate-spin text-yellow-400" />;
    return <Clock size={15} className="text-zinc-400" />;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Fila de Posts</h1>
            <p className="text-zinc-400 mt-1">Posts agendados para Instagram e TikTok</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchPosts}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm transition-colors"
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
            <button
              onClick={handlePublishNow}
              disabled={publishing}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Agendar Agora
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3 text-violet-300 text-sm">
            {message}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
          {["pending", "done", "error"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
                filter === s ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
              )}
            >
              {s === "pending" ? "Pendentes" : s === "done" ? "Publicados" : "Erros"}
            </button>
          ))}
        </div>

        {/* Posts list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-400" size={32} />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            <Clock size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhum post {filter === "pending" ? "pendente" : filter === "done" ? "publicado" : "com erro"}.</p>
            {filter === "pending" && (
              <p className="text-sm mt-2">
                Vá para{" "}
                <a href="/batch" className="text-violet-400 hover:underline">
                  Processamento em Lote
                </a>{" "}
                para gerar posts.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const hashtags = JSON.parse(post.hashtags || "[]") as string[];
              return (
                <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {statusIcon(post.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-white font-medium text-sm truncate">{post.title}</h3>
                          <span className="text-base">{platformIcon(post.platform)}</span>
                        </div>
                        {post.episode_name && (
                          <p className="text-zinc-600 text-xs mt-0.5">Episódio: {post.episode_name}</p>
                        )}
                        <p className="text-zinc-500 text-xs mt-1 line-clamp-1">{post.description}</p>
                        {hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {hashtags.slice(0, 4).map((h) => (
                              <span key={h} className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">
                                #{h}
                              </span>
                            ))}
                          </div>
                        )}
                        {post.error && (
                          <p className="text-red-400 text-xs mt-2">{post.error}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-xs text-zinc-500">{formatDate(post.scheduled_at)}</span>
                      <span className={cn("text-xs font-medium capitalize", statusColor(post.status))}>
                        {post.status === "pending" ? "Agendado" : post.status === "done" ? "Publicado" : post.status === "publishing" ? "Publicando..." : "Erro"}
                      </span>
                      {post.status === "pending" && (
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
