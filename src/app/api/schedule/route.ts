import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";

    const posts = db.prepare(`
      SELECT * FROM scheduled_posts
      WHERE status = ?
      ORDER BY scheduled_at ASC
      LIMIT 100
    `).all(status);

    const episodes = db.prepare(`
      SELECT * FROM processed_episodes
      ORDER BY created_at DESC
      LIMIT 50
    `).all();

    return NextResponse.json({ posts, episodes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const db = getDb();
    db.prepare("DELETE FROM scheduled_posts WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
