#!/usr/bin/env node
// record-episode.js
// Grava episódio automaticamente via OBS WebSocket
// Usa "Captura de Janela" — você pode usar o PC normalmente enquanto grava

const OBSWebSocket = require("obs-websocket-js").default;
const { spawn, exec } = require("child_process");
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const os = require("os");

const episodes = require("./episodes-data");

// ─── Config ─────────────────────────────────────────────────────────────────

const OBS_WS_URL = process.env.OBS_WS_URL || "ws://localhost:4455";
const OBS_WS_PASSWORD = process.env.OBS_WS_PASSWORD || "";
const OUTPUT_FOLDER = process.env.CLIPS_FOLDER || path.join(os.homedir(), "Videos", "Episodios");
const OBS_PATH = "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe";

// ─── Helpers ────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function color(text, c) {
  const codes = { red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37, bright: 1 };
  return `\x1b[${codes[c] || 0}m${text}\x1b[0m`;
}

function ensureFolder() {
  if (!fs.existsSync(OUTPUT_FOLDER)) fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

function isOBSRunning() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq obs64.exe"', (err, stdout) => {
      resolve(stdout.toLowerCase().includes("obs64.exe"));
    });
  });
}

async function launchOBS() {
  const running = await isOBSRunning();
  if (running) {
    console.log(color("  ✓ OBS já está rodando.", "green"));
    return;
  }
  if (fs.existsSync(OBS_PATH)) {
    console.log(color("  → Abrindo OBS Studio (minimizado)...", "cyan"));
    spawn(OBS_PATH, ["--minimize-to-tray", "--startrecording"], { detached: true, stdio: "ignore" }).unref();
    await sleep(5000);
    console.log(color("  ✓ OBS aberto.", "green"));
  } else {
    console.log(color("  ⚠ OBS não encontrado. Abra manualmente.", "yellow"));
    await ask("  Pressione Enter quando o OBS estiver aberto...");
  }
}

async function connectOBS() {
  const obs = new OBSWebSocket();
  try {
    await obs.connect(OBS_WS_URL, OBS_WS_PASSWORD || undefined);
    console.log(color("  ✓ Conectado ao OBS via WebSocket.", "green"));
    return obs;
  } catch (err) {
    console.log(color("\n  ❌ Não consegui conectar ao OBS WebSocket.", "red"));
    console.log(color("  Configure no OBS: Ferramentas → WebSocket Server Settings", "yellow"));
    console.log(color("  - Ative 'Enable WebSocket Server'", "yellow"));
    console.log(color("  - Porta: 4455", "yellow"));
    console.log(color("  - Se colocou senha, defina OBS_WS_PASSWORD no .env\n", "yellow"));
    return null;
  }
}

async function setupRecording(obs, outputFile) {
  // Set output path
  try {
    await obs.call("SetProfileParameter", {
      parameterCategory: "SimpleOutput",
      parameterName: "FilePath",
      parameterValue: OUTPUT_FOLDER,
    });
  } catch {}

  // Set filename format
  try {
    await obs.call("SetProfileParameter", {
      parameterCategory: "Output",
      parameterName: "FilenameFormatting",
      parameterValue: path.basename(outputFile, ".mp4"),
    });
  } catch {}
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  ensureFolder();
  console.clear();
  console.log(color("\n╔══════════════════════════════════════════════════════╗", "magenta"));
  console.log(color("║   MULTIVERSO DOS DESENHOS — Gravação Automática      ║", "magenta"));
  console.log(color("╚══════════════════════════════════════════════════════╝\n", "magenta"));

  // Filter only HBO Max and Crunchyroll
  const available = episodes.filter((e) => e.platform === "HBO Max" || e.platform === "Crunchyroll");
  const sorted = [...available].sort((a, b) => b.viralScore - a.viralScore);

  // Show list
  console.log(color("  Episódios disponíveis (HBO Max + Crunchyroll):\n", "cyan"));
  const indexMap = {};
  let idx = 1;
  let lastShow = "";

  for (const ep of sorted) {
    if (ep.show !== lastShow) {
      console.log(color(`\n  ${ep.show.toUpperCase()}`, "cyan"));
      lastShow = ep.show;
    }
    indexMap[idx] = ep;
    const score = ep.viralScore >= 9 ? color(`${ep.viralScore}/10`, "green") : color(`${ep.viralScore}/10`, "yellow");
    console.log(`  [${String(idx).padStart(2, "0")}] T${ep.season}E${String(ep.episode).padStart(2, "0")} — ${ep.title}  ${score}`);
    console.log(color(`       ${ep.reason}`, "white"));
    idx++;
  }

  // Select
  const choice = await ask(color("\n  Número do episódio: ", "yellow"));
  const selected = indexMap[parseInt(choice.trim())];
  if (!selected) {
    console.log(color("  ❌ Inválido.", "red"));
    rl.close();
    return;
  }

  const safeName = `${selected.show.replace(/[^a-zA-Z0-9]/g, "_")}_S${String(selected.season).padStart(2, "0")}E${String(selected.episode).padStart(2, "0")}`;
  const outputFile = path.join(OUTPUT_FOLDER, `${safeName}.mp4`);

  console.log(color(`\n  Selecionado: ${selected.show} — T${selected.season}E${String(selected.episode).padStart(2, "0")}`, "green"));
  console.log(color(`  "${selected.title}"`, "bright"));
  console.log(color(`  Duração: ~${selected.duration} min | Plataforma: ${selected.platform}`, "cyan"));
  console.log(color(`  Arquivo: ${outputFile}\n`, "cyan"));

  // Launch OBS
  await launchOBS();

  // Connect
  const obs = await connectOBS();
  if (!obs) {
    rl.close();
    return;
  }

  // Setup
  await setupRecording(obs, outputFile);

  // Open streaming platform
  const urls = { "HBO Max": "https://www.max.com", "Crunchyroll": "https://www.crunchyroll.com" };
  const url = urls[selected.platform];
  console.log(color(`\n  → Abrindo ${selected.platform}...`, "cyan"));
  exec(`start "" "${url}"`);

  console.log(color("\n  ══════════════════════════════════════════════════", "yellow"));
  console.log(color("  INSTRUÇÕES:", "yellow"));
  console.log(`  1. No Chrome/Edge, navegue até:`);
  console.log(color(`     ${selected.show} → Temporada ${selected.season} → Episódio ${selected.episode}`, "white"));
  console.log(`  2. Clique no modo "Teatro" do player (ícone de expandir)`);
  console.log(`  3. NÃO precisa de F11 — o OBS captura a janela em background`);
  console.log(`  4. Pause no início do episódio`);
  console.log(color("  ══════════════════════════════════════════════════\n", "yellow"));

  console.log(color("  O OBS está usando 'Captura de Janela' — você pode usar o PC normalmente.", "green"));
  console.log(color("  A gravação acontece em background sem interferir no seu uso.\n", "green"));

  await ask(color("  Pressione Enter quando o episódio estiver pronto para dar play...", "green"));

  // Start recording
  try {
    await obs.call("StartRecord");
    console.log(color("\n  ✓ GRAVAÇÃO INICIADA!", "green"));
    console.log(color(`  Gravando: ${safeName}`, "cyan"));
    console.log(color(`  Duração estimada: ${selected.duration} minutos`, "cyan"));
    console.log(color("  Você pode usar o PC normalmente. O OBS grava em background.\n", "green"));
  } catch (err) {
    console.log(color(`  ❌ Erro ao iniciar gravação: ${err.message}`, "red"));
    obs.disconnect();
    rl.close();
    return;
  }

  // Dê play no episódio
  console.log(color("  ▶ DÊ PLAY NO EPISÓDIO AGORA!", "green"));
  console.log(color("  (Pode minimizar o Chrome e usar o PC — a gravação continua)\n", "cyan"));

  // Timer
  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, selected.duration * 60 - elapsed);
    process.stdout.write(`\r  ⏱ Gravando: ${formatDuration(elapsed)} | Restante: ~${formatDuration(remaining)}   `);
  }, 1000);

  await ask("\n\n  Pressione Enter quando o episódio terminar...\n");

  // Stop recording
  clearInterval(timerInterval);
  try {
    await obs.call("StopRecord");
    console.log(color("\n  ✓ GRAVAÇÃO PARADA!", "green"));
  } catch (err) {
    console.log(color(`\n  ⚠ Erro ao parar: ${err.message}. Pare manualmente no OBS.`, "yellow"));
  }

  obs.disconnect();

  // Check if file exists
  await sleep(2000);
  const files = fs.readdirSync(OUTPUT_FOLDER).filter((f) => f.includes(safeName));
  if (files.length > 0) {
    const finalPath = path.join(OUTPUT_FOLDER, files[files.length - 1]);
    console.log(color(`\n  ✅ EPISÓDIO GRAVADO COM SUCESSO!`, "green"));
    console.log(color(`  Arquivo: ${finalPath}`, "cyan"));
  } else {
    console.log(color(`\n  ⚠ Arquivo não encontrado em ${OUTPUT_FOLDER}`, "yellow"));
    console.log(color("  Verifique o caminho de gravação nas configurações do OBS.", "yellow"));
  }

  console.log(color("\n  Próximo passo:", "yellow"));
  console.log(`  Execute: node scripts/process-folder.js`);
  console.log(color(`  Ou dê duplo clique em: scripts/2-processar-pasta.bat\n`, "cyan"));

  const another = await ask(color("  Gravar outro episódio? (s/n): ", "yellow"));
  rl.close();

  if (another.trim().toLowerCase() === "s") {
    const { spawn: sp } = require("child_process");
    sp(process.execPath, [__filename], { stdio: "inherit" }).on("close", process.exit);
  }
}

main().catch((err) => {
  console.error(color(`\n  Erro: ${err.message}`, "red"));
  process.exit(1);
});
