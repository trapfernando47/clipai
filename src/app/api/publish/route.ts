import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getDb, getSetting } from "@/lib/db";
import { scheduleTikTokPost } from "@/lib/social/tiktok";
import { scheduleReelToInstagram } from "@/lib/social/instagram";

// This endpoint is called by a cron job at 7am daily
// It picks up to 3 pending posts and schedules them for 9h, 12h, 18h
export async function POST(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "clipai-cron";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get next 3 pending posts
  const pending = db.prepare(`
    SELECT * FROM scheduled_posts
    WHERE status = 'pending'
    ORDER BY scheduled_at ASC
    LIMIT 3
  `).all() as any[];

  if (pending.length === 0) {
    return NextResponse.json({ message: "Nenhum post pendente." });
  }

  const results: any[] = [];

  for (const post of pending) {
    db.prepare("UPDATE scheduled_posts SET status='publishing' WHERE id=?").run(post.id);

    try {
      const hashtags = JSON.parse(post.hashtags || "[]");
      const scheduledAt = new Date(post.scheduled_at);
      const clipPath = post.clip_path;

      if (!fs.existsSync(clipPath)) {
        throw new Error(`Arquivo do clipe não encontrado: ${clipPath}`);
      }

      let tiktokId: string | null = null;
      let instagramId: string | null = null;

      // TikTok via Playwright
      if (post.platform === "tiktok" || post.platform === "both") {
        tiktokId = await scheduleTikTokPost(clipPath, post.title, hashtags, scheduledAt);
      }

      // Instagram via Graph API
      // Instagram requires a public URL — upload to a temp hosting or use local server URL
      if (post.platform === "instagram" || post.platform === "both") {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const caption = `${post.title}\n\n${hashtags.map((h: string) => `#${h}`).join(" ")}`;
        // Serve the clip file via /api/serve-clip endpoint
        const videoUrl = `${baseUrl}/api/serve-clip?id=${post.id}`;
        instagramId = await scheduleReelToInstagram(videoUrl, caption, scheduledAt);
      }

      db.prepare(`
        UPDATE scheduled_posts
        SET status='done', tiktok_post_id=?, instagram_post_id=?
        WHERE id=?
      `).run(tiktokId, instagramId, post.id);

      results.push({ id: post.id, title: post.title, status: "done", tiktokId, instagramId });
    } catch (err: any) {
      db.prepare("UPDATE scheduled_posts SET status='error', error=? WHERE id=?")
        .run(err.message, post.id);
      results.push({ id: post.id, title: post.title, status: "error", error: err.message });
    }
  }

  return NextResponse.json({ published: results.length, results });
}

// Manual trigger for testing
export async function GET(req: NextRequest) {
  const db = getDb();
  const pending = db.prepare(
    "SELECT COUNT(*) as count FROM scheduled_posts WHERE status='pending'"
  ).get() as { count: number };

  return NextResponse.json({ pendingPosts: pending.count });
}
