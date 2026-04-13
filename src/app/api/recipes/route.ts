import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getRecipeInformation } from "@/lib/spoonacular";
import { searchRecipeVideo } from "@/lib/youtube";
import { resolveRecipeImage } from "@/lib/images";

const postSchema = z.object({
  kind: z.enum(["spoonacular", "openai", "custom"]),
  source: z.enum(["suggested", "searched", "custom"]).default("custom"),
  spoonacularId: z.number().optional(),
  /** For openai / custom */
  name: z.string().optional(),
  ingredients: z.array(z.string()).optional().default([]),
  thumbnailUrl: z.string().nullable().optional(),
});

export async function GET() {
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

  const { data, error } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recipes: data ?? [] });
}

export async function POST(req: Request) {
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  let name = body.name?.trim() ?? "";
  let ingredients = body.ingredients ?? [];
  let thumb = body.thumbnailUrl ?? null;
  let spoonacularId: number | null = null;
  let source = body.source;

  try {
    if (body.kind === "spoonacular") {
      if (!body.spoonacularId) {
        return NextResponse.json(
          { error: "spoonacularId required" },
          { status: 400 },
        );
      }
      spoonacularId = body.spoonacularId;
      const info = await getRecipeInformation(body.spoonacularId);
      name = info.title;
      ingredients = info.ingredients;
      thumb = info.image;
      source = body.source;
    } else if (body.kind === "openai") {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { error: "name required for openai kind" },
          { status: 400 },
        );
      }
      name = body.name.trim();
      ingredients = body.ingredients ?? [];
      source = "suggested";
      spoonacularId = null;
    } else {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { error: "name required for custom kind" },
          { status: 400 },
        );
      }
      name = body.name.trim();
      ingredients = body.ingredients ?? [];
      source = "custom";
      spoonacularId = null;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upstream error" },
      { status: 502 },
    );
  }

  if (!thumb) {
    try {
      const resolved = await resolveRecipeImage(name, user.id);
      thumb = resolved.imageUrl;
    } catch {
      // non-critical — proceed without thumbnail
    }
  }

  const yt = await searchRecipeVideo(name);

  const { data: recipe, error: insErr } = await supabase
    .from("recipes")
    .insert({
      user_id: user.id,
      name,
      spoonacular_id: spoonacularId,
      thumbnail_url: thumb,
      source,
      youtube_video_id: yt?.videoId ?? null,
      youtube_url: yt?.url ?? null,
    })
    .select()
    .single();

  if (insErr || !recipe) {
    return NextResponse.json(
      { error: insErr?.message ?? "Insert failed" },
      { status: 500 },
    );
  }

  const rows = ingredients.map((n, i) => ({
    recipe_id: recipe.id,
    name: n,
    sort_order: i,
  }));

  if (rows.length > 0) {
    const { error: riErr } = await supabase
      .from("recipe_ingredients")
      .insert(rows);
    if (riErr) {
      await supabase.from("recipes").delete().eq("id", recipe.id);
      return NextResponse.json({ error: riErr.message }, { status: 500 });
    }
  }

  const { data: full } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*)")
    .eq("id", recipe.id)
    .single();

  return NextResponse.json({ recipe: full });
}
