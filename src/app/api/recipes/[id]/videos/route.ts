import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { searchRecipeVideos } from "@/lib/youtube";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Config error" },
      { status: 500 },
    );
  }

  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id, name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !recipe)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const youtubeConfigured = Boolean(env.YOUTUBE_API_KEY);
  const videos = youtubeConfigured
    ? await searchRecipeVideos(recipe.name, 6)
    : [];
  return NextResponse.json({ videos, youtubeConfigured });
}
