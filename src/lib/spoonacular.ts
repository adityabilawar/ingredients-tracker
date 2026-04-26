import { getServerEnv } from "@/lib/env";
import { PANTRY_STAPLES } from "@/lib/pantry-staples";
import type { RecipeStep } from "@/types/database";

export type SpoonacularBrief = {
  id: number;
  title: string;
  image: string | null;
  usedIngredientCount?: number;
  missedIngredientCount?: number;
  /** Strings like "2 cups flour" — only present on findByIngredients output */
  missedIngredients?: string[];
  usedIngredients?: string[];
};

export type SpoonacularSearchHit = SpoonacularBrief & {
  readyInMinutes: number | null;
  /** kcal per serving when nutrition is available */
  caloriesPerServing: number | null;
};

export type SpoonacularRecipeDetails = {
  id: number;
  title: string;
  image: string | null;
  ingredients: string[];
  instructions: RecipeStep[];
  readyInMinutes: number | null;
  servings: number | null;
  sourceUrl: string | null;
};

function apiKey(): string | null {
  try {
    return getServerEnv().SPOONACULAR_API_KEY ?? null;
  } catch {
    return null;
  }
}

type RawIngredient = {
  original?: string;
  originalName?: string;
  name?: string;
};

function ingredientLine(i: RawIngredient): string | null {
  const v = (i.original ?? i.originalName ?? i.name ?? "").trim();
  return v || null;
}

export async function findByIngredients(
  ingredients: string[],
): Promise<SpoonacularBrief[]> {
  const key = apiKey();
  if (!key || ingredients.length === 0) return [];

  const withStaples = [
    ...new Set([...ingredients, ...PANTRY_STAPLES]),
  ];

  const url = new URL(
    "https://api.spoonacular.com/recipes/findByIngredients",
  );
  url.searchParams.set("ingredients", withStaples.join(","));
  url.searchParams.set("number", "12");
  url.searchParams.set("ranking", "1");
  url.searchParams.set("ignorePantry", "true");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  console.log(
    `[spoonacular] findByIngredients status=${res.status} ingredients=${ingredients.length}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[spoonacular] findByIngredients error body:`, body);
    return [];
  }
  const data = (await res.json()) as Array<{
    id: number;
    title: string;
    image?: string;
    usedIngredientCount?: number;
    missedIngredientCount?: number;
    missedIngredients?: { original?: string; name?: string }[];
    usedIngredients?: { original?: string; name?: string }[];
  }>;
  const list = Array.isArray(data) ? data : [];
  console.log(`[spoonacular] findByIngredients returned ${list.length} recipes`);
  return list.map((r) => ({
    id: r.id,
    title: r.title,
    image: r.image ?? null,
    usedIngredientCount: r.usedIngredientCount ?? 0,
    missedIngredientCount: r.missedIngredientCount ?? 0,
    missedIngredients: (r.missedIngredients ?? [])
      .map(ingredientLine)
      .filter((v): v is string => Boolean(v)),
    usedIngredients: (r.usedIngredients ?? [])
      .map(ingredientLine)
      .filter((v): v is string => Boolean(v)),
  }));
}

export async function searchRecipes(
  query: string,
): Promise<SpoonacularSearchHit[]> {
  const key = apiKey();
  if (!key || !query.trim()) return [];

  const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("number", "12");
  url.searchParams.set("addRecipeInformation", "true");
  url.searchParams.set("addRecipeNutrition", "true");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  console.log(
    `[spoonacular] searchRecipes status=${res.status} query="${query.trim()}"`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[spoonacular] searchRecipes error body:`, body);
    return [];
  }
  const data = (await res.json()) as {
    results?: {
      id: number;
      title: string;
      image?: string;
      readyInMinutes?: number;
      nutrition?: {
        nutrients?: { name?: string; amount?: number }[];
      };
    }[];
  };
  const results = data.results ?? [];
  console.log(`[spoonacular] searchRecipes returned ${results.length} recipes`);
  return results.map((r) => {
    const cal = (r.nutrition?.nutrients ?? []).find(
      (n) => n.name?.toLowerCase() === "calories",
    )?.amount;
    return {
      id: r.id,
      title: r.title,
      image: r.image ?? null,
      readyInMinutes:
        typeof r.readyInMinutes === "number" ? r.readyInMinutes : null,
      caloriesPerServing: typeof cal === "number" ? Math.round(cal) : null,
    };
  });
}

/**
 * Best-effort lookup by recipe title — used when an old saved recipe (created
 * back when AI titles were allowed) needs to be backfilled with real data.
 * Returns the top complexSearch hit, if any.
 */
export async function findSpoonacularIdByTitle(
  title: string,
): Promise<number | null> {
  const key = apiKey();
  const q = title.trim();
  if (!key || !q) return null;

  const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
  url.searchParams.set("query", q);
  url.searchParams.set("number", "1");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: { id?: number }[] };
  const id = data.results?.[0]?.id;
  return typeof id === "number" ? id : null;
}

export async function getRecipeInformation(
  spoonacularId: number,
): Promise<SpoonacularRecipeDetails> {
  const key = apiKey();
  if (!key) throw new Error("Spoonacular not configured");

  const url = new URL(
    `https://api.spoonacular.com/recipes/${spoonacularId}/information`,
  );
  url.searchParams.set("includeNutrition", "false");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  console.log(
    `[spoonacular] getRecipeInformation status=${res.status} id=${spoonacularId}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[spoonacular] getRecipeInformation error body:`, body);
    throw new Error("Failed to load recipe from Spoonacular");
  }

  const data = (await res.json()) as {
    id?: number;
    title?: string;
    image?: string;
    readyInMinutes?: number;
    servings?: number;
    sourceUrl?: string;
    spoonacularSourceUrl?: string;
    extendedIngredients?: RawIngredient[];
    analyzedInstructions?: { steps?: { number?: number; step?: string }[] }[];
    instructions?: string;
  };

  const ingredients = (data.extendedIngredients ?? [])
    .map(ingredientLine)
    .filter((v): v is string => Boolean(v));

  const steps: RecipeStep[] = [];
  const blocks = data.analyzedInstructions ?? [];
  for (const block of blocks) {
    for (const s of block.steps ?? []) {
      const text = (s.step ?? "").trim();
      if (!text) continue;
      const num = typeof s.number === "number" ? s.number : steps.length + 1;
      steps.push({ number: num, step: text });
    }
  }
  /** Some Spoonacular entries only set the legacy plain-text `instructions`. */
  if (steps.length === 0 && typeof data.instructions === "string") {
    const plain = stripHtml(data.instructions);
    const fragments = plain
      .split(/(?:\r?\n)+|(?<=\.)\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter(Boolean);
    fragments.forEach((step, idx) =>
      steps.push({ number: idx + 1, step }),
    );
  }

  return {
    id: data.id ?? spoonacularId,
    title: data.title ?? "Recipe",
    image: data.image ?? null,
    ingredients,
    instructions: steps,
    readyInMinutes:
      typeof data.readyInMinutes === "number" ? data.readyInMinutes : null,
    servings: typeof data.servings === "number" ? data.servings : null,
    sourceUrl: data.sourceUrl ?? data.spoonacularSourceUrl ?? null,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
