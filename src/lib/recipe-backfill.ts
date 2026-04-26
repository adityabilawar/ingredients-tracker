import { createClient } from "@/lib/supabase/server";
import {
  findSpoonacularIdByTitle,
  getRecipeInformation,
} from "@/lib/spoonacular";
import { resolveRecipeImage } from "@/lib/images";
import type { Database, RecipeStep } from "@/types/database";

type RecipeUpdate = Database["public"]["Tables"]["recipes"]["Update"];

export type BackfillableRecipe = {
  id: string;
  name: string;
  spoonacular_id: number | null;
  thumbnail_url: string | null;
  instructions: RecipeStep[] | null;
};

/**
 * Bring a legacy AI-era recipe up to the new "real recipe" shape: real photo,
 * step-by-step instructions, ready time, servings, source URL, and a fresh
 * ingredient list. No-op when the recipe already has instructions.
 */
export async function backfillRecipeFromSpoonacular(
  recipe: BackfillableRecipe,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  const hasInstructions =
    Array.isArray(recipe.instructions) && recipe.instructions.length > 0;
  if (hasInstructions && recipe.spoonacular_id) return;

  let id = recipe.spoonacular_id;
  if (!id) {
    id = await findSpoonacularIdByTitle(recipe.name);
    if (!id) return;
  }

  let info: Awaited<ReturnType<typeof getRecipeInformation>>;
  try {
    info = await getRecipeInformation(id);
  } catch (err) {
    console.error(
      `[recipes/${recipe.id}] backfill failed for spoon=${id}:`,
      err,
    );
    return;
  }

  const updates: RecipeUpdate = {
    spoonacular_id: id,
    instructions: info.instructions.length > 0 ? info.instructions : null,
    ready_in_minutes: info.readyInMinutes,
    servings: info.servings,
    source_url: info.sourceUrl,
  };

  if (info.image) {
    updates.thumbnail_url = info.image;
  } else if (!recipe.thumbnail_url) {
    try {
      const resolved = await resolveRecipeImage(info.title);
      updates.thumbnail_url = resolved.imageUrl;
    } catch {
      /* non-critical */
    }
  }

  await supabase.from("recipes").update(updates).eq("id", recipe.id);

  if (info.ingredients.length > 0) {
    await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("recipe_id", recipe.id);
    const rows = info.ingredients.map((n, i) => ({
      recipe_id: recipe.id,
      name: n,
      sort_order: i,
    }));
    const { error: riErr } = await supabase
      .from("recipe_ingredients")
      .insert(rows);
    if (riErr) {
      console.error(
        `[recipes/${recipe.id}] failed to replace ingredients:`,
        riErr,
      );
    }
  }
}
