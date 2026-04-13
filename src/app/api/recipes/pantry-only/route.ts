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

export async function GET() {
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

  const key = env.SPOONACULAR_API_KEY;

  if (!key) {
    const strictAi = await suggestPantryOnlyRecipesWithOpenAI(names);
    if (strictAi.length > 0) {
      return NextResponse.json({
        provider: "openai" as const,
        recipes: strictAi.map((r) => ({
          aiId: r.id,
          title: r.title,
          image: r.image,
          ingredients: r.ingredients,
        })),
      });
    }
    const wideAi = await suggestRecipesWithOpenAI(names);
    if (wideAi.length > 0) {
      return NextResponse.json({
        provider: "openai" as const,
        recipes: wideAi.map((r) => ({
          aiId: r.id,
          title: r.title,
          image: r.image,
          ingredients: r.ingredients,
        })),
      });
    }
    return NextResponse.json({
      provider: "none" as const,
      recipes: [],
      message: "Spoonacular not configured. Add OPENAI_API_KEY for pantry ideas.",
    });
  }

  const withStaples = [...new Set([...names, ...PANTRY_STAPLES])];

  const url = new URL(
    "https://api.spoonacular.com/recipes/findByIngredients",
  );
  url.searchParams.set("ingredients", withStaples.join(","));
  url.searchParams.set("number", "50");
  url.searchParams.set("ranking", "1");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const strictAi = await suggestPantryOnlyRecipesWithOpenAI(names);
    if (strictAi.length > 0) {
      return NextResponse.json({
        provider: "openai" as const,
        recipes: strictAi.map((r) => ({
          aiId: r.id,
          title: r.title,
          image: r.image,
          ingredients: r.ingredients,
        })),
      });
    }
    const wideAi = await suggestRecipesWithOpenAI(names);
    if (wideAi.length > 0) {
      return NextResponse.json({
        provider: "openai" as const,
        recipes: wideAi.map((r) => ({
          aiId: r.id,
          title: r.title,
          image: r.image,
          ingredients: r.ingredients,
        })),
      });
    }
    return NextResponse.json({
      provider: "none" as const,
      recipes: [],
      message: "Recipe lookup failed. Try again later.",
    });
  }

  const data = (await res.json()) as SpoonacularRow[];

  const list = Array.isArray(data) ? data : [];

  const strict = list.filter((r) => (r.missedIngredientCount ?? 0) === 0);
  const strictSlice = mapSpoonacular(strict.slice(0, 12));

  if (strictSlice.length > 0) {
    return NextResponse.json({
      provider: "spoonacular" as const,
      recipes: strictSlice,
    });
  }

  const relaxed = list
    .filter((r) => {
      const m = r.missedIngredientCount ?? 0;
      return m > 0 && m <= 2;
    })
    .sort(
      (a, b) =>
        (a.missedIngredientCount ?? 0) - (b.missedIngredientCount ?? 0),
    );
  const relaxedSlice = mapSpoonacular(relaxed.slice(0, 12));

  if (relaxedSlice.length > 0) {
    return NextResponse.json({
      provider: "spoonacular" as const,
      recipes: relaxedSlice,
    });
  }

  const strictAi = await suggestPantryOnlyRecipesWithOpenAI(names);
  if (strictAi.length > 0) {
    return NextResponse.json({
      provider: "openai" as const,
      recipes: strictAi.map((r) => ({
        aiId: r.id,
        title: r.title,
        image: r.image,
        ingredients: r.ingredients,
      })),
    });
  }

  const wideAi = await suggestRecipesWithOpenAI(names);
  if (wideAi.length > 0) {
    return NextResponse.json({
      provider: "openai" as const,
      recipes: wideAi.map((r) => ({
        aiId: r.id,
        title: r.title,
        image: r.image,
        ingredients: r.ingredients,
      })),
    });
  }

  return NextResponse.json({
    provider: "none" as const,
    recipes: [],
    message: "No pantry-only matches right now. Try again or add more ingredients.",
  });
}
