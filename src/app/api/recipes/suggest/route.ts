import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { findByIngredients } from "@/lib/spoonacular";

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
      recipes: [],
      message: "Add ingredients to get suggestions.",
    });
  }

  const spoon = await findByIngredients(names);
  if (spoon.length === 0) {
    return NextResponse.json({
      provider: "none" as const,
      recipes: [],
      message: "No matches yet. Try adding more ingredients.",
    });
  }

  return NextResponse.json({
    provider: "spoonacular" as const,
    recipes: spoon.map((r) => ({
      spoonacularId: r.id,
      title: r.title,
      image: r.image,
      usedIngredientCount: r.usedIngredientCount,
      missedIngredientCount: r.missedIngredientCount,
      missedIngredients: r.missedIngredients ?? [],
      usedIngredients: r.usedIngredients ?? [],
    })),
  });
}
