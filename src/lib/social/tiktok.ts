import { chromium, BrowserContext } from "playwright";
import path from "path";
import fs from "fs";
import os from "os";

const COOKIES_PATH = process.env.TIKTOK_COOKIES_PATH ||
  path.join(os.homedir(), ".clipai", "tiktok-cookies.json");

export async function getTikTokContext(): Promise<BrowserContext> {
  const browser = await chromium.launch({ headless: true });

  let storageState: any = undefined;
  if (fs.existsSync(COOKIES_PATH)) {
    const raw = fs.readFileSync(COOKIES_PATH, "utf-8");
    storageState = JSON.parse(raw);
  }

  const context = await browser.newContext({
    storageState,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "pt-BR",
  });

  return context;
}

export async function postToTikTok(
  videoPath: string,
  title: string,
  hashtags: string[]
): Promise<string> {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Arquivo de vídeo não encontrado: ${videoPath}`);
  }

  const context = await getTikTokContext();
  const page = await context.newPage();

  try {
    // Navigate to TikTok upload page
    await page.goto("https://www.tiktok.com/upload", { waitUntil: "networkidle", timeout: 30000 });

    // Check if logged in
    const isLoggedIn = await page.locator('[data-e2e="upload-icon"]').isVisible({ timeout: 10000 }).catch(() => false);
    if (!isLoggedIn) {
      throw new Error("TikTok não está autenticado. Atualize os cookies.");
    }

    // Upload video file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(videoPath);

    // Wait for upload to process
    await page.waitForSelector('[data-e2e="caption-input"]', { timeout: 60000 });

    // Clear and set caption with hashtags
    const caption = `${title}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;
    const captionInput = page.locator('[data-e2e="caption-input"]');
    await captionInput.click();
    await captionInput.fill("");
    await captionInput.type(caption, { delay: 30 });

    // Wait for video processing to complete
    await page.waitForSelector('[data-e2e="upload-btn"]:not([disabled])', { timeout: 120000 });

    // Click post button
    await page.locator('[data-e2e="upload-btn"]').click();

    // Wait for success
    await page.waitForSelector('[data-e2e="upload-success"]', { timeout: 30000 });

    // Save updated cookies
    const updatedState = await context.storageState();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(updatedState, null, 2));

    return `tiktok_${Date.now()}`;
  } finally {
    await context.close();
  }
}

export async function scheduleTikTokPost(
  videoPath: string,
  title: string,
  hashtags: string[],
  scheduledAt: Date
): Promise<string> {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Arquivo de vídeo não encontrado: ${videoPath}`);
  }

  const context = await getTikTokContext();
  const page = await context.newPage();

  try {
    await page.goto("https://www.tiktok.com/upload", { waitUntil: "networkidle", timeout: 30000 });

    const isLoggedIn = await page.locator('[data-e2e="upload-icon"]').isVisible({ timeout: 10000 }).catch(() => false);
    if (!isLoggedIn) {
      throw new Error("TikTok não está autenticado. Atualize os cookies.");
    }

    // Upload video
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(videoPath);

    await page.waitForSelector('[data-e2e="caption-input"]', { timeout: 60000 });

    // Set caption
    const caption = `${title}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;
    const captionInput = page.locator('[data-e2e="caption-input"]');
    await captionInput.click();
    await captionInput.fill("");
    await captionInput.type(caption, { delay: 30 });

    // Enable scheduled posting
    const scheduleToggle = page.locator('[data-e2e="schedule-switch"]');
    const isScheduleVisible = await scheduleToggle.isVisible({ timeout: 5000 }).catch(() => false);

    if (isScheduleVisible) {
      await scheduleToggle.click();

      // Set date and time
      const dateStr = scheduledAt.toISOString().split("T")[0];
      const hours = scheduledAt.getHours().toString().padStart(2, "0");
      const minutes = scheduledAt.getMinutes().toString().padStart(2, "0");

      const dateInput = page.locator('[data-e2e="schedule-date-input"]');
      if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dateInput.fill(dateStr);
      }

      const timeInput = page.locator('[data-e2e="schedule-time-input"]');
      if (await timeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await timeInput.fill(`${hours}:${minutes}`);
      }
    }

    // Wait for processing and post
    await page.waitForSelector('[data-e2e="upload-btn"]:not([disabled])', { timeout: 120000 });
    await page.locator('[data-e2e="upload-btn"]').click();
    await page.waitForSelector('[data-e2e="upload-success"]', { timeout: 30000 });

    // Save updated cookies
    const updatedState = await context.storageState();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(updatedState, null, 2));

    return `tiktok_scheduled_${Date.now()}`;
  } finally {
    await context.close();
  }
}
