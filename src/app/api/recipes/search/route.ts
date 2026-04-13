import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { searchRecipes } from "@/lib/spoonacular";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const results = await searchRecipes(q);
  return NextResponse.json({
    recipes: results.map((r) => ({
      spoonacularId: r.id,
      title: r.title,
      image: r.image,
      readyInMinutes: r.readyInMinutes,
      caloriesPerServing: r.caloriesPerServing,
    })),
  });
}
