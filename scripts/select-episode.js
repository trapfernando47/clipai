#!/usr/bin/env node
// select-episode.js
// Script interativo para selecionar episódio, abrir Chrome e gravar com OBS

const readline = require("readline");
const { exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const episodes = require("./episodes-data");

const OUTPUT_FOLDER = process.env.CLIPS_FOLDER ||
  path.join(os.homedir(), "Videos", "Episodios");

const OBS_PATH = process.env.OBS_PATH ||
  "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe";

const CHROME_PATH = process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// ─── Helpers ────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function clearScreen() {
  process.stdout.write("\x1Bc");
}

function colorize(text, color) {
  const colors = {
    reset: "\x1b[0m", bright: "\x1b[1m",
    red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
    blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m",
  };
  return `${colors[color] || ""}${text}${colors.reset}`;
}

function scoreBar(score) {
  const filled = Math.round(score);
  const empty = 10 - filled;
  return colorize("█".repeat(filled), score >= 9 ? "green" : score >= 7 ? "yellow" : "red") +
    colorize("░".repeat(empty), "white");
}

function ensureOutputFolder() {
  if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
    console.log(colorize(`\n📁 Pasta criada: ${OUTPUT_FOLDER}`, "cyan"));
  }
}

// ─── Display ────────────────────────────────────────────────────────────────

function showEpisodeList(filtered) {
  clearScreen();
  console.log(colorize("\n╔══════════════════════════════════════════════════════╗", "magenta"));
  console.log(colorize("║     MULTIVERSO DOS DESENHOS — Seletor de Episódios   ║", "magenta"));
  console.log(colorize("╚══════════════════════════════════════════════════════╝\n", "magenta"));

  const shows = [...new Set(filtered.map((e) => e.show))];

  let index = 1;
  const indexMap = {};

  for (const show of shows) {
    console.log(colorize(`\n  ${show.toUpperCase()}`, "cyan"));
    console.log(colorize("  " + "─".repeat(50), "white"));

    const showEps = filtered.filter((e) => e.show === show);
    for (const ep of showEps) {
      indexMap[index] = ep;
      const num = colorize(`[${String(index).padStart(2, "0")}]`, "yellow");
      const score = scoreBar(ep.viralScore);
      const platform = colorize(`(${ep.platform})`, "blue");
      console.log(`  ${num} T${ep.season}E${String(ep.episode).padStart(2, "0")} — ${ep.title}`);
      console.log(`       ${score} ${ep.viralScore}/10  ${platform}`);
      console.log(colorize(`       ${ep.reason}`, "white"));
      if (ep.memes.length > 0) {
        console.log(colorize(`       Memes: ${ep.memes.join(" • ")}`, "magenta"));
      }
      console.log();
      index++;
    }
  }

  return indexMap;
}

// ─── OBS Control ────────────────────────────────────────────────────────────

function isOBSRunning() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq obs64.exe"', (err, stdout) => {
      resolve(stdout.toLowerCase().includes("obs64.exe"));
    });
  });
}

async function startOBS() {
  const running = await isOBSRunning();
  if (running) {
    console.log(colorize("  ✓ OBS já está rodando.", "green"));
    return;
  }

  if (!fs.existsSync(OBS_PATH)) {
    console.log(colorize(`  ⚠ OBS não encontrado em: ${OBS_PATH}`, "yellow"));
    console.log(colorize("  Abra o OBS manualmente e pressione Enter para continuar.", "yellow"));
    await ask("");
    return;
  }

  console.log(colorize("  → Abrindo OBS Studio...", "cyan"));
  spawn(OBS_PATH, ["--minimize-to-tray"], { detached: true, stdio: "ignore" }).unref();
  await new Promise((r) => setTimeout(r, 3000));
  console.log(colorize("  ✓ OBS aberto.", "green"));
}

function startRecording(outputPath) {
  // OBS WebSocket or CLI — using obs-cmd if available, fallback to manual
  return new Promise((resolve) => {
    exec(`obs-cmd --websocket obsws://localhost:4455/secret recording start`, (err) => {
      if (err) {
        // Fallback: user starts manually
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function stopRecording() {
  return new Promise((resolve) => {
    exec(`obs-cmd --websocket obsws://localhost:4455/secret recording stop`, (err) => {
      resolve(!err);
    });
  });
}

// ─── Chrome ─────────────────────────────────────────────────────────────────

function openChrome(url) {
  const chromePaths = [
    CHROME_PATH,
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];

  for (const p of chromePaths) {
    if (fs.existsSync(p)) {
      spawn(p, [
        "--new-window",
        "--window-size=1920,1080",
        "--start-fullscreen",
        url || "about:blank",
      ], { detached: true, stdio: "ignore" }).unref();
      return p;
    }
  }

  // Fallback: use start command
  exec(`start chrome "${url || "about:blank"}"`);
  return "chrome (system)";
}

// ─── Main Flow ───────────────────────────────────────────────────────────────

async function main() {
  ensureOutputFolder();
  clearScreen();

  console.log(colorize("\n╔══════════════════════════════════════════════════════╗", "magenta"));
  console.log(colorize("║     MULTIVERSO DOS DESENHOS — Seletor de Episódios   ║", "magenta"));
  console.log(colorize("╚══════════════════════════════════════════════════════╝\n", "magenta"));

  // Filter by show
  console.log(colorize("  Filtrar por desenho:", "cyan"));
  console.log("  [1] Todos");
  console.log("  [2] Bob Esponja");
  console.log("  [3] Simpsons");
  console.log("  [4] Dexter's Laboratory");
  console.log("  [5] Dragon Ball Z");
  console.log("  [6] Rick and Morty");

  const filterChoice = await ask(colorize("\n  Escolha (Enter = todos): ", "yellow"));
  const showMap = {
    "2": "Bob Esponja", "3": "Simpsons",
    "4": "Dexter's Laboratory", "5": "Dragon Ball Z", "6": "Rick and Morty",
  };

  let filtered = episodes;
  if (showMap[filterChoice.trim()]) {
    filtered = episodes.filter((e) => e.show === showMap[filterChoice.trim()]);
  }

  // Sort by viral score
  filtered = [...filtered].sort((a, b) => b.viralScore - a.viralScore);

  const indexMap = showEpisodeList(filtered);

  const choice = await ask(colorize("  Digite o número do episódio: ", "yellow"));
  const selected = indexMap[parseInt(choice.trim())];

  if (!selected) {
    console.log(colorize("\n  ❌ Episódio inválido.", "red"));
    rl.close();
    return;
  }

  clearScreen();
  console.log(colorize("\n  EPISÓDIO SELECIONADO:", "green"));
  console.log(colorize(`  ${selected.show} — T${selected.season}E${String(selected.episode).padStart(2, "0")}`, "white"));
  console.log(colorize(`  "${selected.title}"`, "bright"));
  console.log(colorize(`\n  Plataforma: ${selected.platform}`, "cyan"));
  console.log(colorize(`  Duração: ~${selected.duration} minutos`, "cyan"));
  console.log(colorize(`\n  Por que gravar este episódio:`, "yellow"));
  console.log(`  ${selected.reason}`);
  console.log(colorize(`\n  Momentos para capturar:`, "yellow"));
  selected.memes.forEach((m) => console.log(`  • ${m}`));

  // Output filename
  const safeName = `${selected.show.replace(/[^a-zA-Z0-9]/g, "_")}_S${String(selected.season).padStart(2, "0")}E${String(selected.episode).padStart(2, "0")}_${selected.title.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const outputPath = path.join(OUTPUT_FOLDER, `${safeName}.mp4`);

  console.log(colorize(`\n  Arquivo de saída:`, "cyan"));
  console.log(`  ${outputPath}`);

  const confirm = await ask(colorize("\n  Confirmar e iniciar gravação? (s/n): ", "yellow"));
  if (confirm.trim().toLowerCase() !== "s") {
    console.log(colorize("\n  Cancelado.", "red"));
    rl.close();
    return;
  }

  // Open streaming platform
  const platformUrls = {
    "Disney+": "https://www.disneyplus.com",
    "HBO Max": "https://www.max.com",
    "Crunchyroll": "https://www.crunchyroll.com",
  };

  const url = platformUrls[selected.platform] || "about:blank";
  console.log(colorize(`\n  → Abrindo ${selected.platform}...`, "cyan"));
  const chromePath = openChrome(url);
  console.log(colorize(`  ✓ Chrome aberto: ${chromePath}`, "green"));

  // Start OBS
  await startOBS();

  console.log(colorize("\n  ══════════════════════════════════════════════", "yellow"));
  console.log(colorize("  INSTRUÇÕES:", "yellow"));
  console.log(`  1. No Chrome, navegue até o episódio:`);
  console.log(colorize(`     ${selected.show} — T${selected.season}E${String(selected.episode).padStart(2, "0")} — "${selected.title}"`, "white"));
  console.log(`  2. Coloque o episódio no início e pause`);
  console.log(`  3. No OBS, configure a fonte como "Captura de Janela" → Chrome`);
  console.log(`  4. Configure o arquivo de saída para:`);
  console.log(colorize(`     ${outputPath}`, "cyan"));
  console.log(colorize("  ══════════════════════════════════════════════\n", "yellow"));

  await ask(colorize("  Pressione Enter quando estiver pronto para gravar...", "green"));

  // Try auto-start OBS recording
  console.log(colorize("\n  → Iniciando gravação...", "cyan"));
  const autoStarted = await startRecording(outputPath);

  if (autoStarted) {
    console.log(colorize("  ✓ Gravação iniciada automaticamente via OBS WebSocket!", "green"));
  } else {
    console.log(colorize("  ⚠ Inicie a gravação manualmente no OBS (botão 'Iniciar Gravação')", "yellow"));
  }

  console.log(colorize("\n  ▶ GRAVANDO — Dê play no episódio agora!", "green"));
  console.log(colorize(`  Duração estimada: ${selected.duration} minutos\n`, "cyan"));

  await ask(colorize("  Pressione Enter quando o episódio terminar para parar a gravação...", "red"));

  // Stop recording
  const autoStopped = await stopRecording();
  if (autoStopped) {
    console.log(colorize("\n  ✓ Gravação parada automaticamente.", "green"));
  } else {
    console.log(colorize("\n  ⚠ Pare a gravação manualmente no OBS.", "yellow"));
    await ask(colorize("  Pressione Enter após parar o OBS...", "yellow"));
  }

  console.log(colorize("\n  ══════════════════════════════════════════════", "green"));
  console.log(colorize("  ✅ EPISÓDIO GRAVADO COM SUCESSO!", "green"));
  console.log(colorize(`  Arquivo: ${outputPath}`, "cyan"));
  console.log(colorize("\n  Próximo passo:", "yellow"));
  console.log(`  Acesse o ClipAI → Lote → cole o caminho da pasta:`);
  console.log(colorize(`  ${OUTPUT_FOLDER}`, "cyan"));
  console.log(colorize("  ══════════════════════════════════════════════\n", "green"));

  // Ask to process another
  const another = await ask(colorize("  Gravar outro episódio? (s/n): ", "yellow"));
  rl.close();

  if (another.trim().toLowerCase() === "s") {
    rl.close();
    // Restart script
    const { spawn: sp } = require("child_process");
    sp(process.execPath, [__filename], { stdio: "inherit" }).on("close", process.exit);
  } else {
    console.log(colorize("\n  Até logo! 🎬\n", "magenta"));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(colorize(`\n  Erro: ${err.message}`, "red"));
  process.exit(1);
});
