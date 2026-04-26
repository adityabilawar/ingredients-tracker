import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { searchRecipeVideo } from "@/lib/youtube";
import { backfillRecipeFromSpoonacular } from "@/lib/recipe-backfill";
import type { Database } from "@/types/database";

type RecipeUpdate = Database["public"]["Tables"]["recipes"]["Update"];

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  ingredients: z.array(z.string()).optional(),
  refreshYoutube: z.boolean().optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  try {
    getServerEnv();
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

  const { data: existing, error } = await supabase
    .from("recipes")
    .select(
      "id, name, spoonacular_id, thumbnail_url, instructions",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await backfillRecipeFromSpoonacular(existing, supabase);

  const { data, error: selectErr } = await supabase
    .from("recipes")
    .select(
      "*, recipe_ingredients(*), recipe_missing_ingredients(*)",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (selectErr || !data)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ recipe: data });
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    getServerEnv();
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from("recipes")
    .select("id, name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextName = parsed.data.name?.trim() ?? existing.name;
  const nameChanged =
    Boolean(parsed.data.name?.trim()) && nextName !== existing.name;

  let ytPatch: {
    youtube_video_id: string | null;
    youtube_url: string | null;
  } | null = null;

  if (parsed.data.refreshYoutube || nameChanged) {
    const yt = await searchRecipeVideo(nextName);
    ytPatch = {
      youtube_video_id: yt?.videoId ?? null,
      youtube_url: yt?.url ?? null,
    };
  }

  const recipeUpdates: RecipeUpdate = {};
  if (parsed.data.name?.trim()) recipeUpdates.name = nextName;
  if (ytPatch) {
    recipeUpdates.youtube_video_id = ytPatch.youtube_video_id;
    recipeUpdates.youtube_url = ytPatch.youtube_url;
  }
  if (Object.keys(recipeUpdates).length > 0) {
    const { error: upErr } = await supabase
      .from("recipes")
      .update(recipeUpdates)
      .eq("id", id)
      .eq("user_id", user.id);
    if (upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  if (parsed.data.ingredients) {
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
    const rows = parsed.data.ingredients.map((n, i) => ({
      recipe_id: id,
      name: n,
      sort_order: i,
    }));
    if (rows.length > 0) {
      const { error: riErr } = await supabase
        .from("recipe_ingredients")
        .insert(rows);
      if (riErr)
        return NextResponse.json({ error: riErr.message }, { status: 500 });
    }
  }

  const { data: full } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*), recipe_missing_ingredients(*)")
    .eq("id", id)
    .single();

  return NextResponse.json({ recipe: full });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    getServerEnv();
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

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
