import fs from "fs";

const INSTAGRAM_API = "https://graph.facebook.com/v19.0";

function getToken(): string {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN não configurado.");
  return token;
}

function getIgUserId(): string {
  const id = process.env.INSTAGRAM_USER_ID;
  if (!id) throw new Error("INSTAGRAM_USER_ID não configurado.");
  return id;
}

export async function uploadReelToInstagram(
  videoUrl: string,
  caption: string
): Promise<string> {
  const token = getToken();
  const userId = getIgUserId();

  // Step 1: Create media container
  const containerRes = await fetch(
    `${INSTAGRAM_API}/${userId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: videoUrl,
        caption,
        access_token: token,
      }),
    }
  );

  const container = await containerRes.json();
  if (!container.id) {
    throw new Error(`Erro ao criar container Instagram: ${JSON.stringify(container)}`);
  }

  // Step 2: Wait for video processing
  let status = "IN_PROGRESS";
  let attempts = 0;
  while (status === "IN_PROGRESS" && attempts < 30) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      `${INSTAGRAM_API}/${container.id}?fields=status_code&access_token=${token}`
    );
    const statusData = await statusRes.json();
    status = statusData.status_code || "ERROR";
    attempts++;
  }

  if (status !== "FINISHED") {
    throw new Error(`Processamento do vídeo falhou no Instagram: ${status}`);
  }

  // Step 3: Publish
  const publishRes = await fetch(
    `${INSTAGRAM_API}/${userId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: token,
      }),
    }
  );

  const published = await publishRes.json();
  if (!published.id) {
    throw new Error(`Erro ao publicar no Instagram: ${JSON.stringify(published)}`);
  }

  return published.id;
}

export async function scheduleReelToInstagram(
  videoUrl: string,
  caption: string,
  scheduledAt: Date
): Promise<string> {
  const token = getToken();
  const userId = getIgUserId();

  const publishTime = Math.floor(scheduledAt.getTime() / 1000);

  // Create scheduled media container
  const containerRes = await fetch(
    `${INSTAGRAM_API}/${userId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: videoUrl,
        caption,
        published: false,
        scheduled_publish_time: publishTime,
        access_token: token,
      }),
    }
  );

  const container = await containerRes.json();
  if (!container.id) {
    throw new Error(`Erro ao agendar no Instagram: ${JSON.stringify(container)}`);
  }

  // Wait for processing
  let status = "IN_PROGRESS";
  let attempts = 0;
  while (status === "IN_PROGRESS" && attempts < 30) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      `${INSTAGRAM_API}/${container.id}?fields=status_code&access_token=${token}`
    );
    const statusData = await statusRes.json();
    status = statusData.status_code || "ERROR";
    attempts++;
  }

  // Schedule publish
  const publishRes = await fetch(
    `${INSTAGRAM_API}/${userId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: token,
      }),
    }
  );

  const published = await publishRes.json();
  if (!published.id) {
    throw new Error(`Erro ao agendar publicação no Instagram: ${JSON.stringify(published)}`);
  }

  return published.id;
}
