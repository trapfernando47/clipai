import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getDb } from "@/lib/db";

// Serves a clip file for Instagram API (needs public URL)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID não fornecido." }, { status: 400 });
  }

  const db = getDb();
  const post = db.prepare("SELECT clip_path FROM scheduled_posts WHERE id = ?").get(id) as
    | { clip_path: string }
    | undefined;

  if (!post || !fs.existsSync(post.clip_path)) {
    return NextResponse.json({ error: "Clipe não encontrado." }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(post.clip_path);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": fileBuffer.length.toString(),
      "Cache-Control": "no-store",
    },
  });
}
