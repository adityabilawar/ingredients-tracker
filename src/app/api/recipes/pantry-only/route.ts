import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { PANTRY_STAPLES } from "@/lib/pantry-staples";

type SpoonacularRow = {
  id: number;
  title: string;
  image: string | null;
  usedIngredientCount: number;
  missedIngredientCount: number;
  missedIngredients: string[];
  usedIngredients: string[];
};

type RawSpoonacular = {
  id: number;
  title: string;
  image?: string;
  usedIngredientCount?: number;
  missedIngredientCount?: number;
  missedIngredients?: { original?: string; name?: string }[];
  usedIngredients?: { original?: string; name?: string }[];
};

function ingredientLine(i: { original?: string; name?: string }) {
  return (i.original ?? i.name ?? "").trim();
}

function mapSpoonacular(rows: RawSpoonacular[]): SpoonacularRow[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    image: r.image ?? null,
    usedIngredientCount: r.usedIngredientCount ?? 0,
    missedIngredientCount: r.missedIngredientCount ?? 0,
    missedIngredients: (r.missedIngredients ?? [])
      .map(ingredientLine)
      .filter(Boolean),
    usedIngredients: (r.usedIngredients ?? [])
      .map(ingredientLine)
      .filter(Boolean),
  }));
}

function normalizeTitle(t: string) {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

function filterExcludedByTitle(
  rows: SpoonacularRow[],
  exclude: string[],
): SpoonacularRow[] {
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
): Promise<RawSpoonacular[]> {
  const withStaples = [...new Set([...names, ...PANTRY_STAPLES])];
  const url = new URL(
    "https://api.spoonacular.com/recipes/findByIngredients",
  );
  url.searchParams.set("ingredients", withStaples.join(","));
  url.searchParams.set("number", "50");
  url.searchParams.set("ranking", "1");
  url.searchParams.set("ignorePantry", "true");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = (await res.json()) as RawSpoonacular[];
  return Array.isArray(data) ? data : [];
}

function pickSpoonacularSubset(list: RawSpoonacular[]): RawSpoonacular[] {
  /** Sort by best pantry match first; allow up to 3 missing items so we
   *  always have enough variety on the page. */
  const eligible = list.filter(
    (r) => (r.missedIngredientCount ?? 0) <= 3,
  );
  return eligible
    .sort(
      (a, b) =>
        (a.missedIngredientCount ?? 0) - (b.missedIngredientCount ?? 0),
    )
    .slice(0, 24);
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
      recipes: [] as SpoonacularRow[],
      message: "Add ingredients to see pantry-only recipes.",
    });
  }

  const spoonKey = env.SPOONACULAR_API_KEY;
  if (!spoonKey) {
    return NextResponse.json({
      provider: "none" as const,
      recipes: [] as SpoonacularRow[],
      message:
        "Spoonacular is not configured. Add SPOONACULAR_API_KEY to see real recipes.",
    });
  }

  const exclude = parseExclude(request);
  const spoonRows = await fetchSpoonacularByIngredients(names, spoonKey);
  const picked = pickSpoonacularSubset(spoonRows);
  const mapped = mapSpoonacular(picked);

  const filtered = filterExcludedByTitle(mapped, exclude);
  const out = filtered.length > 0 ? filtered : mapped;

  if (out.length === 0) {
    return NextResponse.json({
      provider: "none" as const,
      recipes: [] as SpoonacularRow[],
      message: "No pantry-only matches right now. Try adding more ingredients.",
    });
  }

  return NextResponse.json({
    provider: "spoonacular" as const,
    recipes: out.map((r) => ({
      spoonacularId: r.id,
      title: r.title,
      image: r.image,
      usedIngredientCount: r.usedIngredientCount,
      missedIngredientCount: r.missedIngredientCount,
      missedIngredients: r.missedIngredients,
      usedIngredients: r.usedIngredients,
    })),
  });
}
