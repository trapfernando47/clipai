#!/usr/bin/env node
// process-folder.js
// Envia a pasta de episódios gravados para o ClipAI e agenda os posts automaticamente

const path = require("path");
const fs = require("fs");
const os = require("os");
const readline = require("readline");

const CLIPS_FOLDER = process.env.CLIPS_FOLDER ||
  path.join(os.homedir(), "Videos", "Episodios");

const CLIPAI_URL = process.env.CLIPAI_URL || "http://localhost:3000";

const OVERLAY_PATH = process.env.OVERLAY_PATH ||
  path.join(os.homedir(), ".clipai", "overlay.png");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function colorize(text, color) {
  const colors = {
    reset: "\x1b[0m", bright: "\x1b[1m",
    red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
    blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m",
  };
  return `${colors[color] || ""}${text}${colors.reset}`;
}

function clearScreen() {
  process.stdout.write("\x1Bc");
}

function getVideoFiles(folder) {
  const exts = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
  return fs.readdirSync(folder)
    .filter((f) => exts.includes(path.extname(f).toLowerCase()))
    .map((f) => ({
      name: path.basename(f, path.extname(f)),
      path: path.join(folder, f),
      size: (fs.statSync(path.join(folder, f)).size / (1024 * 1024)).toFixed(1),
    }));
}

async function sendToBatch(folderPath, overlayBase64, format, platform) {
  const res = await fetch(`${CLIPAI_URL}/api/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderPath, overlayBase64, format, platform }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro na API");
  }

  return res.json();
}

async function main() {
  clearScreen();
  console.log(colorize("\n╔══════════════════════════════════════════════════════╗", "magenta"));
  console.log(colorize("║   MULTIVERSO DOS DESENHOS — Processar Episódios      ║", "magenta"));
  console.log(colorize("╚══════════════════════════════════════════════════════╝\n", "magenta"));

  // Check folder
  const folderInput = await ask(
    colorize(`  Pasta dos episódios [${CLIPS_FOLDER}]: `, "cyan")
  );
  const folder = folderInput.trim() || CLIPS_FOLDER;

  if (!fs.existsSync(folder)) {
    console.log(colorize(`\n  ❌ Pasta não encontrada: ${folder}`, "red"));
    rl.close();
    return;
  }

  const videos = getVideoFiles(folder);
  if (videos.length === 0) {
    console.log(colorize("\n  ❌ Nenhum vídeo encontrado na pasta.", "red"));
    rl.close();
    return;
  }

  console.log(colorize(`\n  Vídeos encontrados (${videos.length}):`, "green"));
  videos.forEach((v, i) => {
    console.log(`  [${i + 1}] ${v.name} — ${v.size} MB`);
  });

  // Format
  console.log(colorize("\n  Formato de saída:", "cyan"));
  console.log("  [1] 16:9 Paisagem — 1920x1080 (Recomendado para Multiverso dos Desenhos)");
  console.log("  [2] 9:16 Stories — 1080x1920 (TikTok/Reels vertical)");
  const formatChoice = await ask(colorize("\n  Escolha [1]: ", "yellow"));
  const format = formatChoice.trim() === "2" ? "9:16" : "16:9";

  // Platform
  console.log(colorize("\n  Publicar em:", "cyan"));
  console.log("  [1] Instagram + TikTok (Recomendado)");
  console.log("  [2] Apenas Instagram");
  console.log("  [3] Apenas TikTok");
  const platformChoice = await ask(colorize("\n  Escolha [1]: ", "yellow"));
  const platformMap = { "2": "instagram", "3": "tiktok" };
  const platform = platformMap[platformChoice.trim()] || "both";

  // Overlay
  let overlayBase64 = null;
  const overlayInput = await ask(
    colorize(`\n  Caminho do PNG da faixa [${OVERLAY_PATH}]: `, "cyan")
  );
  const overlayFile = overlayInput.trim() || OVERLAY_PATH;

  if (fs.existsSync(overlayFile)) {
    overlayBase64 = fs.readFileSync(overlayFile).toString("base64");
    console.log(colorize(`  ✓ Faixa carregada: ${path.basename(overlayFile)}`, "green"));
  } else {
    console.log(colorize("  ⚠ PNG não encontrado — clipes serão gerados sem faixa.", "yellow"));
  }

  // Confirm
  console.log(colorize("\n  ══════════════════════════════════════════════", "yellow"));
  console.log(colorize("  RESUMO:", "yellow"));
  console.log(`  Pasta: ${folder}`);
  console.log(`  Vídeos: ${videos.length} episódios`);
  console.log(`  Formato: ${format}`);
  console.log(`  Plataforma: ${platform}`);
  console.log(`  Faixa: ${overlayBase64 ? "✓ carregada" : "✗ sem faixa"}`);
  console.log(`  ClipAI URL: ${CLIPAI_URL}`);
  console.log(colorize("  ══════════════════════════════════════════════\n", "yellow"));

  const confirm = await ask(colorize("  Iniciar processamento? (s/n): ", "green"));
  if (confirm.trim().toLowerCase() !== "s") {
    console.log(colorize("\n  Cancelado.\n", "red"));
    rl.close();
    return;
  }

  console.log(colorize("\n  → Enviando para o ClipAI...", "cyan"));
  console.log(colorize("  (Isso pode levar vários minutos dependendo do número de episódios)\n", "white"));

  // Progress indicator
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let spinIdx = 0;
  const spinInterval = setInterval(() => {
    process.stdout.write(`\r  ${colorize(spinner[spinIdx % spinner.length], "cyan")} Processando episódios...`);
    spinIdx++;
  }, 100);

  try {
    const result = await sendToBatch(folder, overlayBase64, format, platform);
    clearInterval(spinInterval);
    process.stdout.write("\r");

    console.log(colorize("\n  ══════════════════════════════════════════════", "green"));
    console.log(colorize("  ✅ PROCESSAMENTO CONCLUÍDO!", "green"));
    console.log(colorize(`  ${result.processed} episódios processados\n`, "cyan"));

    let totalClips = 0;
    for (const r of result.results || []) {
      if (r.status === "done") {
        const clips = r.clips?.length || 0;
        totalClips += clips;
        console.log(colorize(`  ✓ ${r.file}`, "green") + ` — ${clips} clipes agendados`);
        if (r.clips) {
          r.clips.forEach((c) => {
            const date = new Date(c.scheduledAt).toLocaleString("pt-BR", {
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            });
            console.log(colorize(`    • ${c.title}`, "white") + colorize(` → ${date}`, "cyan"));
          });
        }
      } else if (r.status === "error") {
        console.log(colorize(`  ✗ ${r.file}`, "red") + ` — ${r.reason}`);
      } else {
        console.log(colorize(`  ↷ ${r.file}`, "yellow") + ` — ${r.reason}`);
      }
    }

    console.log(colorize(`\n  Total de clipes agendados: ${totalClips}`, "bright"));
    console.log(colorize(`\n  Acesse ${CLIPAI_URL}/schedule para ver a fila completa.`, "cyan"));
    console.log(colorize("  ══════════════════════════════════════════════\n", "green"));
  } catch (err) {
    clearInterval(spinInterval);
    process.stdout.write("\r");
    console.log(colorize(`\n  ❌ Erro: ${err.message}`, "red"));
    console.log(colorize(`  Verifique se o ClipAI está rodando em ${CLIPAI_URL}`, "yellow"));
  }

  rl.close();
}

main().catch((err) => {
  console.error(colorize(`\n  Erro fatal: ${err.message}`, "red"));
  process.exit(1);
});
