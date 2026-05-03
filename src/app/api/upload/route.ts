import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { ensureTmpDir } from "@/lib/ffmpeg";


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/mpeg"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato inválido. Use MP4, WebM, MOV, AVI ou MPEG." },
        { status: 400 }
      );
    }

    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 500MB." },
        { status: 400 }
      );
    }

    const videoId = uuidv4();
    const ext = file.name.split(".").pop() || "mp4";
    const uploadDir = ensureTmpDir("uploads");
    const filePath = path.join(uploadDir, `${videoId}.${ext}`);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    return NextResponse.json({
      videoId,
      filePath,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Erro ao fazer upload do arquivo." }, { status: 500 });
  }
}
