import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { PANTRY_STAPLES } from "@/lib/pantry-staples";
import {
  suggestPantryOnlyRecipesWithOpenAI,
  suggestRecipesWithOpenAI,
} from "@/lib/openai-recipes";

type SpoonacularRow = {
  id: number;
  title: string;
  image: string | null;
  usedIngredientCount?: number;
  missedIngredientCount?: number;
};

function mapSpoonacular(rows: SpoonacularRow[]) {
  return rows.map((r) => ({
    spoonacularId: r.id,
    title: r.title,
    image: r.image,
    usedIngredientCount: r.usedIngredientCount ?? 0,
    missedIngredientCount: r.missedIngredientCount ?? 0,
  }));
}

function normalizeTitle(t: string) {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

function filterExcludedByTitle<T extends { title: string }>(
  rows: T[],
  exclude: string[],
): T[] {
  if (exclude.length === 0) return rows;
  const ex = new Set(exclude.map(normalizeTitle));
  return rows.filter((r) => !ex.has(normalizeTitle(r.title)));
}

function parseExclude(request: Request): string[] {
  const url = new URL(request.url);
  const multi = url.searchParams.getAll("exclude");
  if (multi.length > 0) {
    return multi.map((s) => s.trim()).filter(Boolean).slice(0, 120);
  }
  const single = url.searchParams.get("exclude");
  if (!single) return [];
  if (single.includes(",")) {
    return single
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 120);
  }
  return [single.trim()];
}

async function fetchSpoonacularByIngredients(
  names: string[],
  key: string,
): Promise<SpoonacularRow[]> {
  const withStaples = [...new Set([...names, ...PANTRY_STAPLES])];
  const url = new URL(
    "https://api.spoonacular.com/recipes/findByIngredients",
  );
  url.searchParams.set("ingredients", withStaples.join(","));
  url.searchParams.set("number", "50");
  url.searchParams.set("ranking", "1");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = (await res.json()) as SpoonacularRow[];
  return Array.isArray(data) ? data : [];
}

function pickSpoonacularSubset(list: SpoonacularRow[]): SpoonacularRow[] {
  const strict = list.filter((r) => (r.missedIngredientCount ?? 0) === 0);
  if (strict.length > 0) return strict.slice(0, 12);

  const relaxed = list
    .filter((r) => {
      const m = r.missedIngredientCount ?? 0;
      return m > 0 && m <= 2;
    })
    .sort(
      (a, b) =>
        (a.missedIngredientCount ?? 0) - (b.missedIngredientCount ?? 0),
    );
  return relaxed.slice(0, 12);
}

export async function GET(request: Request) {
  let env;
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

  const { data: rows } = await supabase
    .from("ingredients")
    .select("name")
    .eq("user_id", user.id);

  const names = (rows ?? []).map((r) => r.name).filter(Boolean);
  if (names.length === 0) {
    return NextResponse.json({
      provider: "none" as const,
      recipes: [] as unknown[],
      message: "Add ingredients to see pantry-only recipes.",
    });
  }

  const exclude = parseExclude(request);
  const openAiKey = env.OPENAI_API_KEY;
  const spoonKey = env.SPOONACULAR_API_KEY;

  /** When OpenAI is configured, AI suggestions are primary; Spoonacular supplements. */
  if (openAiKey) {
    let aiList = await suggestPantryOnlyRecipesWithOpenAI(names, { exclude });
    if (aiList.length === 0) {
      aiList = await suggestRecipesWithOpenAI(names, { exclude });
    }

    let spoonSlice: ReturnType<typeof mapSpoonacular> = [];
    if (spoonKey) {
      const spoonRows = await fetchSpoonacularByIngredients(names, spoonKey);
      const picked = pickSpoonacularSubset(spoonRows);
      const aiTitles = new Set(
        aiList.map((r) => normalizeTitle(r.title)),
      );
      spoonSlice = filterExcludedByTitle(
        mapSpoonacular(
          picked.filter(
            (r) => !aiTitles.has(normalizeTitle(r.title)),
          ),
        ),
        exclude,
      ).slice(0, 8);
    }

    if (aiList.length > 0 && spoonSlice.length > 0) {
      return NextResponse.json({
        provider: "mixed" as const,
        recipes: [
          ...aiList.map((r) => ({
            type: "openai" as const,
            aiId: r.id,
            title: r.title,
            image: r.image,
            ingredients: r.ingredients,
            cuisine: r.cuisine,
            meal_type: r.meal_type,
            description: r.description,
          })),
          ...spoonSlice.map((r) => ({
            type: "spoonacular" as const,
            ...r,
          })),
        ],
      });
    }

    if (aiList.length > 0) {
      return NextResponse.json({
        provider: "openai" as const,
        recipes: aiList.map((r) => ({
          aiId: r.id,
          title: r.title,
          image: r.image,
          ingredients: r.ingredients,
          cuisine: r.cuisine,
          meal_type: r.meal_type,
          description: r.description,
        })),
      });
    }

    // AI empty: fall back to Spoonacular-only if available
    if (spoonKey) {
      const spoonRows = await fetchSpoonacularByIngredients(names, spoonKey);
      const picked = pickSpoonacularSubset(spoonRows);
      const spoonSliceOnly = mapSpoonacular(picked);
      if (spoonSliceOnly.length > 0) {
        const filtered = filterExcludedByTitle(spoonSliceOnly, exclude);
        const out = filtered.length > 0 ? filtered : spoonSliceOnly;
        return NextResponse.json({
          provider: "spoonacular" as const,
          recipes: out,
        });
      }
    }

    return NextResponse.json({
      provider: "none" as const,
      recipes: [],
      message:
        "No pantry-only matches right now. Try Show me more or add more ingredients.",
    });
  }

  // No OpenAI key: Spoonacular-first (legacy behavior)
  if (!spoonKey) {
    return NextResponse.json({
      provider: "none" as const,
      recipes: [],
      message: "Spoonacular not configured. Add OPENAI_API_KEY for pantry ideas.",
    });
  }

  const spoonRows = await fetchSpoonacularByIngredients(names, spoonKey);
  const picked = pickSpoonacularSubset(spoonRows);
  const spoonSliceOnly = mapSpoonacular(picked);

  if (spoonSliceOnly.length > 0) {
    const filtered = filterExcludedByTitle(spoonSliceOnly, exclude);
    const out = filtered.length > 0 ? filtered : spoonSliceOnly;
    return NextResponse.json({
      provider: "spoonacular" as const,
      recipes: out,
    });
  }

  const strictAi = await suggestPantryOnlyRecipesWithOpenAI(names, {
    exclude,
  });
  if (strictAi.length > 0) {
    return NextResponse.json({
      provider: "openai" as const,
      recipes: strictAi.map((r) => ({
        aiId: r.id,
        title: r.title,
        image: r.image,
        ingredients: r.ingredients,
        cuisine: r.cuisine,
        meal_type: r.meal_type,
        description: r.description,
      })),
    });
  }

  const wideAi = await suggestRecipesWithOpenAI(names, { exclude });
  if (wideAi.length > 0) {
    return NextResponse.json({
      provider: "openai" as const,
      recipes: wideAi.map((r) => ({
        aiId: r.id,
        title: r.title,
        image: r.image,
        ingredients: r.ingredients,
        cuisine: r.cuisine,
        meal_type: r.meal_type,
        description: r.description,
      })),
    });
  }

  return NextResponse.json({
    provider: "none" as const,
    recipes: [],
    message: "No pantry-only matches right now. Try again or add more ingredients.",
  });
}
