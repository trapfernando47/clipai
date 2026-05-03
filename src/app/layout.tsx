import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ClipAI — Clipes Virais com Inteligência Artificial",
  description:
    "Transforme vídeos longos em clipes virais para TikTok, Instagram Reels e YouTube Shorts usando GPT-4o e Whisper AI.",
  keywords: ["clipes virais", "IA", "TikTok", "Reels", "Shorts", "edição de vídeo"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
