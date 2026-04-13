import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { searchPantryShortsVideos } from "@/lib/youtube";

export async function GET() {
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

  const videos = await searchPantryShortsVideos(names, 15);
  return NextResponse.json({
    youtubeConfigured: true as const,
    videos,
  });
}
