import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { ensureTmpDir } from "@/lib/ffmpeg";

const execAsync = promisify(exec);

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL não fornecida." }, { status: 400 });
    }

    const ytId = extractYouTubeId(url);
    if (!ytId) {
      return NextResponse.json({ error: "URL do YouTube inválida." }, { status: 400 });
    }

    const videoId = uuidv4();
    const uploadDir = ensureTmpDir("uploads");
    const outputPath = path.join(uploadDir, `${videoId}.mp4`);

    // Use yt-dlp if available, fallback to ytdl-core approach via node script
    // yt-dlp must be installed on the system or available in PATH
    try {
      await execAsync(
        `yt-dlp -f "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputPath}" "${url}"`,
        { timeout: 300000 }
      );
    } catch {
      // Fallback: try ytdl-core via a small inline script
      const script = `
        const ytdl = require('ytdl-core');
        const fs = require('fs');
        const stream = ytdl('${url}', { quality: 'highestvideo' });
        stream.pipe(fs.createWriteStream('${outputPath.replace(/\\/g, "\\\\")}'));
        stream.on('end', () => process.exit(0));
        stream.on('error', (e) => { console.error(e); process.exit(1); });
      `;
      const tmpScript = path.join(ensureTmpDir(), `dl-${videoId}.js`);
      const { writeFileSync } = await import("fs");
      writeFileSync(tmpScript, script);
      await execAsync(`node "${tmpScript}"`, { timeout: 300000 });
      try { require("fs").unlinkSync(tmpScript); } catch {}
    }

    return NextResponse.json({
      videoId,
      filePath: outputPath,
      youtubeId: ytId,
      url,
    });
  } catch (err: any) {
    console.error("YouTube download error:", err);
    return NextResponse.json(
      { error: "Erro ao baixar vídeo do YouTube. Verifique se yt-dlp está instalado." },
      { status: 500 }
    );
  }
}
