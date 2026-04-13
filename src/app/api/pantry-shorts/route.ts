import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { searchPantryShortsVideosDiverse } from "@/lib/youtube";

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: Request) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Config error" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const youtubeConfigured = Boolean(env.YOUTUBE_API_KEY);
  if (!youtubeConfigured) {
    return NextResponse.json({
      youtubeConfigured: false as const,
      videos: [],
    });
  }

  const { data: rows } = await supabase
    .from("ingredients")
    .select("name")
    .eq("user_id", user.id);

  const names = (rows ?? []).map((r) => r.name).filter(Boolean);
  if (names.length === 0) {
    return NextResponse.json({
      youtubeConfigured: true as const,
      videos: [],
      message: "Add ingredients to your pantry to see Shorts picks.",
    });
  }

  const url = new URL(request.url);
  const maxVideos = clampInt(url.searchParams.get("maxVideos"), 45, 10, 50);
  const maxSearches = clampInt(url.searchParams.get("maxSearches"), 12, 4, 14);

  const videos = await searchPantryShortsVideosDiverse(names, {
    seedSalt: user.id,
    maxVideos,
    maxSearches,
  });
  return NextResponse.json({
    youtubeConfigured: true as const,
    videos,
  });
}
