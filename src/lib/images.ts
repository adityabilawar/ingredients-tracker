import { randomUUID } from "crypto";
import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type ImageSource = "pexels" | "dalle" | "placeholder";

export type ResolvedImage = {
  imageUrl: string;
  source: ImageSource;
};

async function searchPexels(query: string, apiKey: string) {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "3");
  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    photos?: { src?: { large?: string; large2x?: string } }[];
  };
  const first = data.photos?.[0]?.src?.large2x || data.photos?.[0]?.src?.large;
  return first ?? null;
}

async function generateDalleAndUpload(
  name: string,
  userId: string,
): Promise<string | null> {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return null;
  }
  const openaiKey = env.OPENAI_API_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!openaiKey || !serviceKey) return null;

  const openai = new OpenAI({ apiKey: openaiKey });
  const img = await openai.images.generate({
    model: "dall-e-3",
    prompt: `Professional food ingredient photo of "${name}", isolated on a clean neutral background, sharp focus, appetizing, no text, no watermark.`,
    size: "1024x1024",
    n: 1,
  });
  const remoteUrl = img.data?.[0]?.url;
  if (!remoteUrl) return null;

  const imageRes = await fetch(remoteUrl);
  if (!imageRes.ok) return null;
  const buf = Buffer.from(await imageRes.arrayBuffer());
  const path = `${userId}/${randomUUID()}.png`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("ingredient-images")
    .upload(path, buf, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) return null;
  const { data } = admin.storage.from("ingredient-images").getPublicUrl(path);
  return data.publicUrl;
}

/** Pexels first; if no match, DALL-E + Supabase Storage; else placeholder. */
export async function resolveItemImage(
  name: string,
  userId: string,
): Promise<ResolvedImage> {
  const trimmed = name.trim();
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return {
      imageUrl: placeholderUrl(trimmed),
      source: "placeholder",
    };
  }

  const pexelsKey = env.PEXELS_API_KEY;
  if (pexelsKey) {
    const url = await searchPexels(trimmed, pexelsKey);
    if (url) return { imageUrl: url, source: "pexels" };
  }

  const uploaded = await generateDalleAndUpload(trimmed, userId);
  if (uploaded) return { imageUrl: uploaded, source: "dalle" };

  return {
    imageUrl: placeholderUrl(trimmed),
    source: "placeholder",
  };
}

function placeholderUrl(text: string) {
  const t = encodeURIComponent(text.slice(0, 40));
  return `https://placehold.co/400x400/e2e8f0/1e293b?text=${t}`;
}
