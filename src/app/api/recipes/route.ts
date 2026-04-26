import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getRecipeInformation } from "@/lib/spoonacular";
import { searchRecipeVideo } from "@/lib/youtube";
import { resolveRecipeImage } from "@/lib/images";

const postSchema = z.object({
  kind: z.enum(["spoonacular", "custom"]),
  source: z.enum(["suggested", "searched", "custom"]).default("custom"),
  spoonacularId: z.number().optional(),
  /** For custom recipes only */
  name: z.string().optional(),
  ingredients: z.array(z.string()).optional().default([]),
  /** Strings the cook is missing from their pantry (only meaningful for spoonacular kind) */
  missingIngredients: z.array(z.string()).optional().default([]),
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
    .select(
      "*, recipe_ingredients(*), recipe_missing_ingredients(*)",
    )
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
  let missing = body.missingIngredients ?? [];
  let thumb = body.thumbnailUrl ?? null;
  let spoonacularId: number | null = null;
  let source = body.source;
  let instructions: { number: number; step: string }[] = [];
  let readyInMinutes: number | null = null;
  let servings: number | null = null;
  let sourceUrl: string | null = null;

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
      instructions = info.instructions;
      readyInMinutes = info.readyInMinutes;
      servings = info.servings;
      sourceUrl = info.sourceUrl;
      source = body.source;
    } else {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { error: "name required for custom kind" },
          { status: 400 },
        );
      }
      name = body.name.trim();
      ingredients = body.ingredients ?? [];
      missing = [];
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
      const resolved = await resolveRecipeImage(name);
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
      instructions: instructions.length > 0 ? instructions : null,
      ready_in_minutes: readyInMinutes,
      servings,
      source_url: sourceUrl,
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

  if (missing.length > 0) {
    const missRows = missing.map((n, i) => ({
      recipe_id: recipe.id,
      name: n,
      sort_order: i,
    }));
    const { error: miErr } = await supabase
      .from("recipe_missing_ingredients")
      .insert(missRows);
    if (miErr) {
      console.error("[recipes] failed to insert missing ingredients", miErr);
    }
  }

  const { data: full } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*), recipe_missing_ingredients(*)")
    .eq("id", recipe.id)
    .single();

  return NextResponse.json({ recipe: full });
}
