import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const postSchema = z.object({
  recipeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

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
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("*, recipes(*)")
    .eq("user_id", user.id)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
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

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", parsed.data.recipeId)
    .eq("user_id", user.id)
    .single();

  if (!recipe)
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("meal_plan_entries")
    .upsert(
      {
        user_id: user.id,
        recipe_id: parsed.data.recipeId,
        date: parsed.data.date,
        meal_type: parsed.data.mealType,
      },
      { onConflict: "user_id,date,meal_type" },
    )
    .select("*, recipes(*)")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}
