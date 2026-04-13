import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { findByIngredients } from "@/lib/spoonacular";
import { suggestRecipesWithOpenAI } from "@/lib/openai-recipes";

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

  const { data: rows } = await supabase
    .from("ingredients")
    .select("name")
    .eq("user_id", user.id);

  const names = (rows ?? []).map((r) => r.name).filter(Boolean);
  if (names.length === 0) {
    return NextResponse.json({
      provider: "none" as const,
      recipes: [] as unknown[],
      message: "Add ingredients to get suggestions.",
    });
  }

  const spoon = await findByIngredients(names);
  if (spoon.length > 0) {
    return NextResponse.json({
      provider: "spoonacular" as const,
      recipes: spoon.map((r) => ({
        spoonacularId: r.id,
        title: r.title,
        image: r.image,
        usedIngredientCount: r.usedIngredientCount,
        missedIngredientCount: r.missedIngredientCount,
      })),
    });
  }

  const ai = await suggestRecipesWithOpenAI(names);
  return NextResponse.json({
    provider: "openai" as const,
    recipes: ai.map((r) => ({
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
