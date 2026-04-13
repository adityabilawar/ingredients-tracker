import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

async function authed() {
  try {
    getServerEnv();
  } catch (e) {
    return { error: NextResponse.json({ error: e instanceof Error ? e.message : "Config error" }, { status: 500 }) };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { supabase, user };
}

const patchSchema = z.object({
  daily_target: z.number().int().min(1).max(20),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await authed();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  let json: unknown;
  try { json = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("supplements")
    .update({ daily_target: parsed.data.daily_target })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ supplement: data });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await authed();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const { error } = await supabase
    .from("supplements")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
