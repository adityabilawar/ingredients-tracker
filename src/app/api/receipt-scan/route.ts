import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  image: z
    .string()
    .min(1)
    .refine(
      (v) => v.startsWith("data:image/"),
      "Must be a base64 data URL (data:image/...)",
    ),
});

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Config error" },
      { status: 500 },
    );
  }

  if (!env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dataUrl = parsed.data.image;
  const base64Part = dataUrl.split(",")[1] ?? "";
  const sizeBytes = Math.ceil(base64Part.length * 0.75);
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image too large (max 10 MB)" },
      { status: 413 },
    );
  }

  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert at reading grocery receipts and identifying food items. Given a photo of a grocery receipt, extract ONLY the food and ingredient items. Exclude non-food items (bags, taxes, discounts, totals, store info, etc). For each item, return a clean, human-readable name (e.g. "Greek Yogurt" not "GRK YGRT 32OZ"). Return JSON: {"items":["item1","item2",...]}. If no food items are found or the image is not a receipt, return {"items":[],"error":"description of issue"}.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the food/grocery items from this receipt.",
            },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
      max_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 502 },
      );
    }

    const result = JSON.parse(raw) as {
      items?: string[];
      error?: string;
    };

    const items = (result.items ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean);

    return NextResponse.json({
      items,
      ...(result.error ? { warning: result.error } : {}),
    });
  } catch (e) {
    console.error("Receipt scan error:", e);
    return NextResponse.json(
      { error: "Failed to process receipt" },
      { status: 500 },
    );
  }
}
