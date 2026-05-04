import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { getVideoDuration, extractAudio, ensureTmpDir, cutClip, cutClipWithOverlay, VideoFormat } from "@/lib/ffmpeg";
import { transcribeAudio, analyzeForViralClips, generateSRT } from "@/lib/openai";
import { getSetting } from "@/lib/db";

// Next scheduled times: 9h, 12h, 18h
function getNextScheduledTimes(count: number): Date[] {
  const slots = [9, 12, 18];
  const now = new Date();
  const times: Date[] = [];

  const db = getDb();
  // Get already scheduled posts to avoid conflicts
  const existing = db.prepare(
    "SELECT scheduled_at FROM scheduled_posts WHERE status = 'pending' ORDER BY scheduled_at ASC"
  ).all() as { scheduled_at: string }[];
  const existingTimes = new Set(existing.map((r) => r.scheduled_at));

  let dayOffset = 0;
  while (times.length < count) {
    for (const hour of slots) {
      if (times.length >= count) break;
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + dayOffset);
      candidate.setHours(hour, 0, 0, 0);

      // Skip past times
      if (candidate <= now) continue;

      const key = candidate.toISOString();
      if (!existingTimes.has(key)) {
        times.push(candidate);
        existingTimes.add(key);
      }
    }
    dayOffset++;
    if (dayOffset > 30) break; // safety
  }

  return times;
}

export async function POST(req: NextRequest) {
  try {
    const { folderPath, overlayBase64, format, platform } = await req.json() as {
      folderPath: string;
      overlayBase64?: string;
      format: VideoFormat;
      platform: "instagram" | "tiktok" | "both";
    };

    if (!folderPath || !fs.existsSync(folderPath)) {
      return NextResponse.json({ error: "Pasta não encontrada." }, { status: 400 });
    }

    // Find all video files in folder
    const videoExts = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".mpeg"];
    const files = fs.readdirSync(folderPath)
      .filter((f) => videoExts.includes(path.extname(f).toLowerCase()))
      .map((f) => path.join(folderPath, f));

    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhum vídeo encontrado na pasta." }, { status: 400 });
    }

    const db = getDb();
    const results: any[] = [];

    // Save overlay to disk if provided
    let overlayPath: string | null = null;
    if (overlayBase64) {
      const overlayDir = ensureTmpDir("overlays");
      overlayPath = path.join(overlayDir, `default-overlay.png`);
      fs.writeFileSync(overlayPath, Buffer.from(overlayBase64, "base64"));
    } else {
      // Try to use saved default overlay
      const savedOverlay = getSetting("default_overlay_path");
      if (savedOverlay && fs.existsSync(savedOverlay)) {
        overlayPath = savedOverlay;
      }
    }

    for (const filePath of files) {
      const episodeName = path.basename(filePath, path.extname(filePath));

      // Check if already processed
      const existing = db.prepare(
        "SELECT id FROM processed_episodes WHERE file_path = ?"
      ).get(filePath);
      if (existing) {
        results.push({ file: episodeName, status: "skipped", reason: "já processado" });
        continue;
      }

      const episodeId = uuidv4();
      db.prepare(
        "INSERT INTO processed_episodes (id, file_path, episode_name, status) VALUES (?, ?, ?, 'processing')"
      ).run(episodeId, filePath, episodeName);

      try {
        // 1. Get duration
        const duration = await getVideoDuration(filePath);
        if (duration < 60) {
          db.prepare("UPDATE processed_episodes SET status='error', error=? WHERE id=?")
            .run("Vídeo muito curto", episodeId);
          results.push({ file: episodeName, status: "error", reason: "vídeo muito curto" });
          continue;
        }

        // 2. Extract audio + transcribe
        const audioDir = ensureTmpDir("audio");
        const audioPath = path.join(audioDir, `${episodeId}.wav`);
        await extractAudio(filePath, audioPath);
        const transcript = await transcribeAudio(audioPath);
        try { fs.unlinkSync(audioPath); } catch {}

        if (transcript.length === 0) {
          db.prepare("UPDATE processed_episodes SET status='error', error=? WHERE id=?")
            .run("Sem transcrição", episodeId);
          results.push({ file: episodeName, status: "error", reason: "sem fala detectada" });
          continue;
        }

        // 3. Analyze for viral clips (get top 3)
        const clips = await analyzeForViralClips(transcript, duration);
        const top3 = clips.sort((a, b) => b.viralScore - a.viralScore).slice(0, 3);

        // 4. Generate clip files
        const clipsDir = ensureTmpDir("ready-clips");
        const scheduledTimes = getNextScheduledTimes(top3.length);
        const generatedClips: any[] = [];

        for (let i = 0; i < top3.length; i++) {
          const clip = top3[i];
          const clipId = uuidv4();
          const clipPath = path.join(clipsDir, `${clipId}.mp4`);
          const clipDuration = clip.endTime - clip.startTime;

          // Generate SRT
          const srtContent = generateSRT(transcript, clip.startTime, clip.endTime);
          const srtDir = ensureTmpDir("srt");
          const srtPath = path.join(srtDir, `${clipId}.srt`);
          fs.writeFileSync(srtPath, srtContent, "utf-8");

          try {
            if (overlayPath) {
              await cutClipWithOverlay(filePath, clipPath, clip.startTime, clipDuration, overlayPath, format);
            } else {
              await cutClip(filePath, clipPath, clip.startTime, clipDuration, format);
            }
          } catch {
            await cutClip(filePath, clipPath, clip.startTime, clipDuration, format);
          } finally {
            try { fs.unlinkSync(srtPath); } catch {}
          }

          // Schedule post
          const postId = uuidv4();
          const scheduledAt = scheduledTimes[i] || new Date(Date.now() + (i + 1) * 3600000);
          const caption = `${clip.title}\n\n${clip.hashtags.map((h) => `#${h}`).join(" ")}`;

          db.prepare(`
            INSERT INTO scheduled_posts
              (id, clip_path, title, description, hashtags, platform, scheduled_at, episode_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            postId,
            clipPath,
            clip.title,
            clip.description,
            JSON.stringify(clip.hashtags),
            platform,
            scheduledAt.toISOString(),
            episodeName
          );

          generatedClips.push({
            clipId: postId,
            title: clip.title,
            viralScore: clip.viralScore,
            scheduledAt: scheduledAt.toISOString(),
          });
        }

        db.prepare(
          "UPDATE processed_episodes SET status='done', clips_generated=?, duration=? WHERE id=?"
        ).run(top3.length, duration, episodeId);

        results.push({ file: episodeName, status: "done", clips: generatedClips });
      } catch (err: any) {
        db.prepare("UPDATE processed_episodes SET status='error', error=? WHERE id=?")
          .run(err.message, episodeId);
        results.push({ file: episodeName, status: "error", reason: err.message });
      }
    }

    return NextResponse.json({ processed: files.length, results });
  } catch (err: any) {
    console.error("Batch error:", err);
    return NextResponse.json({ error: err.message || "Erro no processamento em lote." }, { status: 500 });
  }
}
