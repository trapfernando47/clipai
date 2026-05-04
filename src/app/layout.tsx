import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Scissors } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ClipAI — Clipes Virais com Inteligência Artificial",
  description:
    "Transforme vídeos longos em clipes virais para TikTok, Instagram Reels e YouTube Shorts usando GPT-4o e Whisper AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <header className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-zinc-950/90 backdrop-blur">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Scissors size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-none">ClipAI</h1>
                <p className="text-zinc-500 text-xs">Multiverso dos Desenhos</p>
              </div>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Clipe Único
              </Link>
              <Link
                href="/batch"
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Lote
              </Link>
              <Link
                href="/schedule"
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Agendados
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
