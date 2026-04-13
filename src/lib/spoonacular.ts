import { getServerEnv } from "@/lib/env";
import { PANTRY_STAPLES } from "@/lib/pantry-staples";

export type SpoonacularBrief = {
  id: number;
  title: string;
  image: string | null;
  usedIngredientCount?: number;
  missedIngredientCount?: number;
};

export type SpoonacularSearchHit = SpoonacularBrief & {
  readyInMinutes: number | null;
  /** kcal per serving when nutrition is available */
  caloriesPerServing: number | null;
};

function apiKey(): string | null {
  try {
    return getServerEnv().SPOONACULAR_API_KEY ?? null;
  } catch {
    return null;
  }
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
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = (await res.json()) as SpoonacularBrief[];
  return Array.isArray(data) ? data : [];
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
  if (!res.ok) return [];
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
  return (data.results ?? []).map((r) => {
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

export async function getRecipeInformation(
  spoonacularId: number,
): Promise<{ title: string; image: string | null; ingredients: string[] }> {
  const key = apiKey();
  if (!key) throw new Error("Spoonacular not configured");

  const url = new URL(
    `https://api.spoonacular.com/recipes/${spoonacularId}/information`,
  );
  url.searchParams.set("includeNutrition", "false");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("Failed to load recipe from Spoonacular");

  const data = (await res.json()) as {
    title?: string;
    image?: string;
    extendedIngredients?: { original?: string; name?: string }[];
  };
  const ingredients = (data.extendedIngredients ?? [])
    .map((i) => i.original || i.name)
    .filter(Boolean) as string[];

  return {
    title: data.title ?? "Recipe",
    image: data.image ?? null,
    ingredients,
  };
}
