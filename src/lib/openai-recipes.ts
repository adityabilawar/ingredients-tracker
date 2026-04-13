import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import { PANTRY_STAPLES } from "@/lib/pantry-staples";

const STAPLES_TEXT = PANTRY_STAPLES.join(", ");

export type SuggestRecipesOptions = {
  /** Recipe titles to avoid (e.g. from prior "Show me more" loads). */
  exclude?: string[];
};

export type AiRecipeBrief = {
  id: string;
  title: string;
  image: null;
  ingredients: string[];
  cuisine: string;
  meal_type: string;
  description: string;
};

const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.2;
const MAX_TOKENS = 4096;
const RECIPE_COUNT_MIN = 10;
const RECIPE_COUNT_MAX = 15;

const CREATIVITY_BLOCK = `Think beyond the obvious: the same pantry can become dozens of dishes across world cuisines.
Demand variety across:
- Cuisines: e.g. Indian, Mexican, Italian, Thai, Japanese, Korean, Chinese, Vietnamese, Mediterranean, Middle Eastern, Ethiopian, Moroccan, American comfort, French-inspired, etc.
- Techniques: stir-fry, roast, bake, braise, soup/stew, salad, grain bowl, wrap/taco, one-pot, sheet-pan, sauté, curry, noodle dish, frittata, etc.
- Meal types: include a mix of breakfast, lunch, dinner, and snack ideas (use meal_type accordingly).

Few-shot style (examples of the creativity level expected):
- With chicken, rice, bell pepper: e.g. Thai basil chicken over rice, stuffed peppers, burrito bowl, chicken fried rice, arroz con pollo-inspired skillet, lemon-pepper chicken sheet pan with peppers.
- With eggs, spinach, cheese: shakshuka-style skillet, frittata, breakfast tacos, palak-style scramble, strata-inspired bake.

Do NOT give only one cuisine or only obvious pairings. Each recipe should feel distinct from the others.`;

function excludeBlock(exclude: string[] | undefined): string {
  const list = (exclude ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 80);
  if (list.length === 0) return "";
  return `\nDo NOT suggest any dish whose title matches or closely duplicates these already-seen titles (case-insensitive): ${list.map((t) => JSON.stringify(t)).join(", ")}.`;
}

function mapRow(
  r: {
    title?: string;
    ingredients?: string[];
    cuisine?: string;
    meal_type?: string;
    description?: string;
  },
  i: number,
  idPrefix: string,
): AiRecipeBrief | null {
  if (!r.title || !Array.isArray(r.ingredients)) return null;
  return {
    id: `${idPrefix}-${i}-${encodeURIComponent(r.title)}`,
    title: r.title,
    image: null,
    ingredients: r.ingredients.map((x) => String(x)),
    cuisine: typeof r.cuisine === "string" ? r.cuisine.trim() || "Fusion" : "Fusion",
    meal_type:
      typeof r.meal_type === "string" ? r.meal_type.trim() || "dinner" : "dinner",
    description:
      typeof r.description === "string"
        ? r.description.trim() || ""
        : "",
  };
}

/** Fallback when Spoonacular returns no matches — allows small extras beyond strict pantry. */
export async function suggestRecipesWithOpenAI(
  pantry: string[],
  options?: SuggestRecipesOptions,
): Promise<AiRecipeBrief[]> {
  let key: string | undefined;
  try {
    key = getServerEnv().OPENAI_API_KEY;
  } catch {
    return [];
  }
  if (!key || pantry.length === 0) return [];

  const exclude = options?.exclude;
  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a creative chef and recipe ideator. Suggest realistic dish names with ingredient lists the home cook needs from their pantry (not full step-by-step cooking instructions — a one-line description per dish is OK in the description field only).

Assume these staples are always available (salt, spices, oils, basic condiments, garlic, onion, flour, sugar, etc.): ${STAPLES_TEXT}

Rules:
- Do NOT list staples in each recipe's "ingredients" array — only non-staple items the cook must have beyond staples.
- Use mostly the user's pantry items; you may assume up to 2 small common add-ons only if essential and typical (e.g. "canned tomatoes" if the user has tomato paste and you're making a stew) — prefer staying within pantry + staples.
- meal_type must be one of: breakfast, lunch, dinner, snack.
- cuisine: short label (e.g. "Thai", "Mexican").
- description: 1–2 sentences selling the dish (no numbered recipe steps).

${CREATIVITY_BLOCK}
${excludeBlock(exclude)}

Return JSON only:
{"recipes":[{"title":"string","ingredients":["string",...],"cuisine":"string","meal_type":"breakfast|lunch|dinner|snack","description":"string"}]}

Return between ${RECIPE_COUNT_MIN} and ${RECIPE_COUNT_MAX} recipes.`,
      },
      {
        role: "user",
        content: `Pantry (non-staple items I have): ${pantry.join(", ")}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      recipes?: {
        title?: string;
        ingredients?: string[];
        cuisine?: string;
        meal_type?: string;
        description?: string;
      }[];
    };
    const list = parsed.recipes ?? [];
    return list
      .map((r, i) => mapRow(r, i, "ai"))
      .filter((x): x is AiRecipeBrief => x !== null);
  } catch {
    return [];
  }
}

/** Strict: every ingredient must be from pantry or staples list only. */
export async function suggestPantryOnlyRecipesWithOpenAI(
  pantry: string[],
  options?: SuggestRecipesOptions,
): Promise<AiRecipeBrief[]> {
  let key: string | undefined;
  try {
    key = getServerEnv().OPENAI_API_KEY;
  } catch {
    return [];
  }
  if (!key || pantry.length === 0) return [];

  const exclude = options?.exclude;
  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a creative chef. The cook may use ONLY these ingredients from their pantry: ${pantry.join(", ")}.

They also always have these staples (do NOT list staples in each recipe's "ingredients" array): ${STAPLES_TEXT}

Every non-staple ingredient in each dish must appear in the pantry list above. No other purchased items. Staples may be used freely but must not appear in "ingredients".

Each recipe needs: title, ingredients (non-staple only), cuisine (short label), meal_type (breakfast|lunch|dinner|snack), description (1–2 sentences — no numbered steps).

${CREATIVITY_BLOCK}
${excludeBlock(exclude)}

Return JSON only:
{"recipes":[{"title":"string","ingredients":["string",...],"cuisine":"string","meal_type":"breakfast|lunch|dinner|snack","description":"string"}]}

Return between ${RECIPE_COUNT_MIN} and ${RECIPE_COUNT_MAX} recipes.`,
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
      recipes?: {
        title?: string;
        ingredients?: string[];
        cuisine?: string;
        meal_type?: string;
        description?: string;
      }[];
    };
    const list = parsed.recipes ?? [];
    return list
      .map((r, i) => mapRow(r, i, "ai-pantry"))
      .filter((x): x is AiRecipeBrief => x !== null);
  } catch {
    return [];
  }
}
