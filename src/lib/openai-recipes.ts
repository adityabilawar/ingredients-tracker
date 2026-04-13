import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import { PANTRY_STAPLES } from "@/lib/pantry-staples";

export type AiRecipeBrief = {
  id: string;
  title: string;
  image: null;
  ingredients: string[];
};

/** Fallback when Spoonacular returns no matches. */
export async function suggestRecipesWithOpenAI(
  pantry: string[],
): Promise<AiRecipeBrief[]> {
  let key: string | undefined;
  try {
    key = getServerEnv().OPENAI_API_KEY;
  } catch {
    return [];
  }
  if (!key || pantry.length === 0) return [];

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You suggest realistic dish names and ingredient lists only (no instructions). Assume the user always has these staples on hand: ${PANTRY_STAPLES.join(", ")}. Do NOT list staples in the ingredients arrays — only list non-staple items. Return JSON: {"recipes":[{"title":"...","ingredients":["..."]}]} with 3-6 recipes using mostly the user's pantry items plus the assumed staples.`,
      },
      {
        role: "user",
        content: `Pantry: ${pantry.join(", ")}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      recipes?: { title?: string; ingredients?: string[] }[];
    };
    const list = parsed.recipes ?? [];
    return list
      .filter((r) => r.title && Array.isArray(r.ingredients))
      .map((r, i) => ({
        id: `ai-${i}-${encodeURIComponent(r.title!)}`,
        title: r.title!,
        image: null,
        ingredients: r.ingredients!.map((x) => String(x)),
      }));
  } catch {
    return [];
  }
}

/** Stricter fallback: dishes must use only the user's pantry plus assumed staples (no extra shopping). */
export async function suggestPantryOnlyRecipesWithOpenAI(
  pantry: string[],
): Promise<AiRecipeBrief[]> {
  let key: string | undefined;
  try {
    key = getServerEnv().OPENAI_API_KEY;
  } catch {
    return [];
  }
  if (!key || pantry.length === 0) return [];

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You suggest realistic dish names and ingredient lists only (no instructions). The cook may use ONLY these ingredients from their pantry: ${pantry.join(", ")}. They also always have these staples (do NOT list staples in the ingredients arrays): ${PANTRY_STAPLES.join(", ")}. Every ingredient in each dish must be either from the pantry list or a staple. No other items. Return JSON: {"recipes":[{"title":"...","ingredients":["..."]}]} with at least 3 and up to 6 recipes.`,
      },
      {
        role: "user",
        content: `Pantry (non-staple): ${pantry.join(", ")}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      recipes?: { title?: string; ingredients?: string[] }[];
    };
    const list = parsed.recipes ?? [];
    return list
      .filter((r) => r.title && Array.isArray(r.ingredients))
      .map((r, i) => ({
        id: `ai-pantry-${i}-${encodeURIComponent(r.title!)}`,
        title: r.title!,
        image: null,
        ingredients: r.ingredients!.map((x) => String(x)),
      }));
  } catch {
    return [];
  }
}
