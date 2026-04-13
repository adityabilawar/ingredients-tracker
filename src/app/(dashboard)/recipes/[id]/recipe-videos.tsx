"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Play } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStatus } from "@/components/loading-status";

type YoutubeMatch = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  url: string;
};

type VideosResponse = {
  videos: YoutubeMatch[];
  youtubeConfigured: boolean;
};

async function jsonFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

export function RecipeVideos({ recipeId }: { recipeId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<YoutubeMatch[]>([]);
  const [youtubeConfigured, setYoutubeConfigured] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch<VideosResponse>(
        `/api/recipes/${recipeId}/videos`,
      );
      setVideos(data.videos ?? []);
      setYoutubeConfigured(data.youtubeConfigured ?? true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <LoadingStatus
        title="Loading videos"
        subtitle="Fetching cooking videos for this recipe…"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-2xl" />
          ))}
        </div>
      </LoadingStatus>
    );
  }

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-2xl border border-dashed px-4 py-6 text-sm">
        {error}
      </div>
    );
  }

  if (!youtubeConfigured) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Add a <code className="bg-muted rounded px-1.5 py-0.5 text-xs">YOUTUBE_API_KEY</code>{" "}
          to your environment to see cooking videos here. See{" "}
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">.env.example</code>.
        </p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
        <p className="text-muted-foreground text-sm leading-relaxed">
          No YouTube results for this recipe name. Try renaming the dish on the edit
          screen and search again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Cooking videos
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Refresh"
          )}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => {
          const expanded = expandedId === v.videoId;
          return (
            <Card
              key={v.videoId}
              className="overflow-hidden rounded-xl border border-border py-0"
            >
              {expanded ? (
                <div className="aspect-video w-full overflow-hidden border-b">
                  <iframe
                    title={v.title}
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${v.videoId}?autoplay=1`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="group/v relative block aspect-video w-full overflow-hidden border-b text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setExpandedId(v.videoId)}
                >
                  <Image
                    src={v.thumbnailUrl}
                    alt=""
                    fill
                    className="object-cover transition duration-500 group-hover/v:scale-[1.04]"
                    sizes="(max-width:1024px) 50vw, 33vw"
                    unoptimized={
                      !v.thumbnailUrl.includes("i.ytimg.com") &&
                      !v.thumbnailUrl.includes("ytimg.com")
                    }
                  />
                  <div className="absolute inset-0 bg-black/35 transition group-hover/v:bg-black/45" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-14 items-center justify-center rounded-full border border-white/40 bg-black/50 text-white shadow-lg backdrop-blur-sm transition group-hover/v:scale-105">
                      <Play className="size-7 translate-x-0.5 fill-current" />
                    </span>
                  </span>
                </button>
              )}
              <CardHeader className="space-y-1 p-4">
                <CardTitle className="line-clamp-2 text-base leading-snug">
                  {v.title}
                </CardTitle>
                <CardDescription className="text-xs">YouTube</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 px-4 pb-4 pt-0">
                {expanded ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setExpandedId(null)}
                  >
                    Show thumbnail
                  </Button>
                ) : null}
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex rounded-lg",
                  )}
                >
                  <ExternalLink className="size-3.5" />
                  Open on YouTube
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
