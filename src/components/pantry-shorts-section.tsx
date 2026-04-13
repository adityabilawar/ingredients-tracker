"use client";

import Image from "next/image";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ExternalLink,
  MessageCircle,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { YoutubeMatch } from "@/lib/youtube";

type PantryShortsResponse =
  | {
      youtubeConfigured: false;
      videos: YoutubeMatch[];
      message?: string;
    }
  | {
      youtubeConfigured: true;
      videos: YoutubeMatch[];
      message?: string;
    };

const FEED_HEIGHT = "min(85dvh,780px)";

async function jsonFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && data.error
        ? String(data.error)
        : `Request failed (${res.status})`,
    );
  }
  return data as T;
}

function decodeHTMLEntities(text: string): string {
  const map: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
  };
  return text.replace(/&(?:#x?[0-9a-f]+|[a-z]+);/gi, (match) => map[match] ?? match);
}

function youtubeEmbedSrc(videoId: string, muted: boolean) {
  const m = muted ? "1" : "0";
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${m}&playsinline=1&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0`;
}

export function PantryShortsSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PantryShortsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [embedMuted, setEmbedMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await jsonFetch<PantryShortsResponse>("/api/pantry-shorts");
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load Shorts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const videos = data?.videos ?? [];

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = el.clientHeight;
    if (h <= 0) return;
    const idx = Math.round(el.scrollTop / h);
    setActiveIndex(Math.min(Math.max(0, idx), Math.max(0, videos.length - 1)));
  }, [videos.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const el = containerRef.current;
      if (!el || videos.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const next = Math.min(activeIndex + 1, videos.length - 1);
        el.scrollTo({ top: next * el.clientHeight, behavior: "smooth" });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prev = Math.max(activeIndex - 1, 0);
        el.scrollTo({ top: prev * el.clientHeight, behavior: "smooth" });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, videos.length]);

  useEffect(() => {
    setEmbedMuted(true);
  }, [activeIndex]);

  async function shareVideo(v: YoutubeMatch) {
    try {
      if (navigator.share) {
        await navigator.share({ title: v.title, url: v.url });
        return;
      }
    } catch {
      /* user cancelled or share failed */
    }
    window.open(v.url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <div
        className="bg-background flex items-center justify-center rounded-xl border border-border"
        style={{ height: FEED_HEIGHT }}
      >
        <p className="text-muted-foreground text-sm">Loading Shorts…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-muted/30 rounded-xl border border-border p-6">
        <p className="text-destructive text-sm">{loadError}</p>
      </div>
    );
  }

  if (!data?.youtubeConfigured) {
    return (
      <div className="bg-muted/30 rounded-xl border border-border p-6">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Add a <code className="bg-muted rounded px-1.5 py-0.5 text-xs">YOUTUBE_API_KEY</code>{" "}
          to your environment to see pantry-based Shorts here.
        </p>
      </div>
    );
  }

  if (data.message && videos.length === 0) {
    return (
      <div className="bg-muted/30 rounded-xl border border-border p-6">
        <p className="text-muted-foreground text-sm leading-relaxed">{data.message}</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="bg-muted/30 rounded-xl border border-border p-6">
        <p className="text-muted-foreground text-sm">
          No Shorts turned up for your pantry. Try adding a few more ingredients.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-black overflow-hidden rounded-xl border border-zinc-800 shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-white">Shorts</span>
          <span className="text-zinc-500 text-xs">YouTube</span>
        </div>
        <span className="text-zinc-400 font-mono text-xs tabular-nums">
          {activeIndex + 1}/{videos.length}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[420px]">
        <div
          ref={containerRef}
          role="region"
          aria-label="Pantry Shorts, vertical video feed. Use arrow keys or J and K to move between videos."
          className={cn(
            "snap-y snap-mandatory overflow-y-auto scroll-smooth",
          )}
          style={{ height: FEED_HEIGHT }}
        >
          {videos.map((v, i) => (
            <div
              key={v.videoId}
              className="relative shrink-0 snap-start bg-black"
              style={{ height: FEED_HEIGHT }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                {i === activeIndex ? (
                  <iframe
                    title={decodeHTMLEntities(v.title)}
                    src={youtubeEmbedSrc(v.videoId, embedMuted)}
                    className="h-full w-full max-w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    className="relative h-full w-full cursor-pointer border-0 bg-black p-0"
                    aria-label={`Play ${decodeHTMLEntities(v.title)}`}
                    onClick={() => {
                      const el = containerRef.current;
                      if (!el) return;
                      el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" });
                    }}
                  >
                    <Image
                      src={v.thumbnailUrl}
                      alt=""
                      fill
                      className="object-contain"
                      sizes="420px"
                      unoptimized={
                        v.thumbnailUrl.startsWith("data:") ||
                        !v.thumbnailUrl.includes("ytimg.com")
                      }
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <div className="size-16 rounded-full border-2 border-white/90 bg-black/40" />
                    </div>
                  </button>
                )}
              </div>

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

              <div className="pointer-events-auto absolute right-2 bottom-28 flex flex-col gap-4">
                <ShortsAction
                  label="Like"
                  icon={<ThumbsUp className="size-6 text-white drop-shadow-md" />}
                  onClick={() => {}}
                />
                <ShortsAction
                  label="Dislike"
                  icon={<ThumbsDown className="size-6 text-white drop-shadow-md" />}
                  onClick={() => {}}
                />
                <ShortsAction
                  label="Comments"
                  icon={<MessageCircle className="size-6 text-white drop-shadow-md" />}
                  onClick={() => window.open(v.url, "_blank", "noopener,noreferrer")}
                />
                <ShortsAction
                  label="Share"
                  icon={<Share2 className="size-6 text-white drop-shadow-md" />}
                  onClick={() => void shareVideo(v)}
                />
              </div>

              <div className="pointer-events-auto absolute bottom-0 left-0 right-16 p-4 pr-2">
                <p className="text-zinc-300 mb-1 text-xs font-medium">
                  @
                  {decodeHTMLEntities(v.channelTitle ?? "YouTube")
                    .replace(/^@+/, "")
                    .slice(0, 48)}
                </p>
                <p className="line-clamp-2 text-sm leading-snug font-medium text-white drop-shadow">
                  {decodeHTMLEntities(v.title)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {i === activeIndex && (
                    <button
                      type="button"
                      onClick={() => setEmbedMuted((m) => !m)}
                      className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
                    >
                      {embedMuted ? "Unmute (may be limited in browser)" : "Mute"}
                    </button>
                  )}
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
                  >
                    <ExternalLink className="size-3.5 shrink-0" />
                    Open in YouTube
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShortsAction({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-full p-1 text-white transition active:scale-95"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-zinc-900/80 ring-1 ring-white/15 backdrop-blur-sm">
        {icon}
      </span>
    </button>
  );
}
