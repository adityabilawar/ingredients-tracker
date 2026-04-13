"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChefHat, Loader2 } from "lucide-react";

const recipeImageUrlCache = new Map<string, string>();

function cacheKey(title: string, recipeId?: string) {
  const t = title.trim().toLowerCase();
  return recipeId ? `id:${recipeId}` : `title:${t}`;
}

export function RecipeImageLoader({
  title,
  recipeId,
  className,
  sizes,
  priority,
}: {
  title: string;
  /** When set, resolved image URL is persisted to this recipe and cache is per-recipe */
  recipeId?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const key = useMemo(() => cacheKey(title, recipeId), [title, recipeId]);

  const initialHit = recipeImageUrlCache.get(key) ?? null;
  const [outcome, setOutcome] = useState<
    undefined | { ok: true; url: string } | { ok: false }
  >(() => (initialHit ? { ok: true, url: initialHit } : undefined));

  const cached = recipeImageUrlCache.get(key) ?? null;
  const url =
    cached ??
    (outcome?.ok === true ? outcome.url : outcome?.ok === false ? null : undefined);

  useEffect(() => {
    let cancelled = false;
    const hit = recipeImageUrlCache.get(key);
    if (hit) {
      void Promise.resolve().then(() => {
        if (!cancelled) setOutcome({ ok: true, url: hit });
      });
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const params = new URLSearchParams({ title });
        if (recipeId) params.set("recipeId", recipeId);
        const res = await fetch(
          `/api/recipes/generate-image?${params.toString()}`,
        );
        const data = (await res.json()) as { imageUrl?: string };
        if (cancelled) return;
        if (data.imageUrl) {
          recipeImageUrlCache.set(key, data.imageUrl);
          setOutcome({ ok: true, url: data.imageUrl });
        } else {
          setOutcome({ ok: false });
        }
      } catch {
        if (!cancelled) setOutcome({ ok: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, title, recipeId]);

  if (url === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="text-muted-foreground size-8 animate-spin opacity-50" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <ChefHat className="text-muted-foreground size-12 opacity-35" />
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={title}
      fill
      className={className ?? "object-cover"}
      sizes={sizes ?? "(max-width:1024px) 50vw, 33vw"}
      unoptimized={url.includes("placehold.co")}
      priority={priority}
    />
  );
}
