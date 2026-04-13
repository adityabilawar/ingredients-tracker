"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChefHat, Loader2 } from "lucide-react";

export function RecipeImageLoader({
  title,
  className,
  sizes,
  priority,
}: {
  title: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/recipes/generate-image?title=${encodeURIComponent(title)}`)
      .then((r) => r.json())
      .then((data: { imageUrl?: string }) => {
        if (!cancelled && data.imageUrl) setSrc(data.imageUrl);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [title]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="text-muted-foreground size-8 animate-spin opacity-50" />
      </div>
    );
  }

  if (!src) {
    return (
      <div className="from-herb-muted/50 flex h-full items-center justify-center bg-gradient-to-br to-terracotta-muted/30">
        <ChefHat className="text-muted-foreground size-12 opacity-35" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={title}
      fill
      className={className ?? "object-cover"}
      sizes={sizes ?? "(max-width:1024px) 50vw, 33vw"}
      unoptimized={src.includes("placehold.co")}
      priority={priority}
    />
  );
}
