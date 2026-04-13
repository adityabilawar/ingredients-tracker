import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { resolveRecipeImage } from "@/lib/images";

const CACHE_CONTROL_SUCCESS = "private, max-age=86400";

export async function GET(req: Request) {
  try {
    getServerEnv();
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

  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title")?.trim();
  if (!title)
    return NextResponse.json(
      { error: "title query param required" },
      { status: 400 },
    );

  const recipeId = searchParams.get("recipeId")?.trim() ?? null;

  const resolved = await resolveRecipeImage(title, user.id);

  if (
    recipeId &&
    resolved.source !== "placeholder" &&
    resolved.imageUrl
  ) {
    await supabase
      .from("recipes")
      .update({ thumbnail_url: resolved.imageUrl })
      .eq("id", recipeId)
      .eq("user_id", user.id);
  }

  return NextResponse.json(
    { imageUrl: resolved.imageUrl, source: resolved.source },
    {
      headers: { "Cache-Control": CACHE_CONTROL_SUCCESS },
    },
  );
}
