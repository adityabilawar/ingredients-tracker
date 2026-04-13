import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PEXELS_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  SPOONACULAR_API_KEY: z.string().min(1).optional(),
  YOUTUBE_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/** Validates public + optional server secrets. Call from server code only. */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SPOONACULAR_API_KEY: process.env.SPOONACULAR_API_KEY,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  });
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(
      `Invalid environment: ${JSON.stringify(msg)}. Copy .env.example to .env.local.`,
    );
  }
  cached = parsed.data;
  return parsed.data;
}

export function requireEnv<K extends keyof ServerEnv>(
  key: K,
): NonNullable<ServerEnv[K]> {
  const env = getServerEnv();
  const v = env[key];
  if (v === undefined || v === null || v === "") {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return v as NonNullable<ServerEnv[K]>;
}
