import { getServerEnv } from "@/lib/env";

export type YoutubeMatch = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  url: string;
  channelTitle?: string;
};

type SearchSnippet = {
  title?: string;
  channelTitle?: string;
  thumbnails?: { high?: { url?: string } };
};

type SearchItem = {
  id?: { videoId?: string };
  snippet?: SearchSnippet;
};

function parseSearchItems(
  fallbackTitle: string,
  items: SearchItem[] | undefined,
): YoutubeMatch[] {
  if (!items?.length) return [];
  const out: YoutubeMatch[] = [];
  for (const item of items) {
    const videoId = item?.id?.videoId;
    if (!videoId) continue;
    const title = item?.snippet?.title ?? fallbackTitle;
    const channelTitle = item?.snippet?.channelTitle;
    const thumb =
      item?.snippet?.thumbnails?.high?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const row: YoutubeMatch = {
      videoId,
      title,
      thumbnailUrl: thumb,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
    if (channelTitle) row.channelTitle = channelTitle;
    out.push(row);
  }
  return out;
}

function youtubeApiKey(): string | undefined {
  try {
    return getServerEnv().YOUTUBE_API_KEY;
  } catch {
    return undefined;
  }
}

async function searchVideos(params: {
  q: string;
  maxResults: number;
  videoDuration?: "short" | "medium" | "long" | "any";
  fallbackTitle: string;
}): Promise<YoutubeMatch[]> {
  const key = youtubeApiKey();
  if (!key) return [];

  const capped = Math.min(Math.max(1, params.maxResults), 50);
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(capped));
  url.searchParams.set("q", params.q);
  url.searchParams.set("key", key);
  if (params.videoDuration && params.videoDuration !== "any") {
    url.searchParams.set("videoDuration", params.videoDuration);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: SearchItem[] };
  return parseSearchItems(params.fallbackTitle, data.items);
}

export async function searchRecipeVideos(
  recipeName: string,
  maxResults = 6,
): Promise<YoutubeMatch[]> {
  const capped = Math.min(Math.max(1, maxResults), 50);
  const q = `${recipeName} recipe cooking`;
  return searchVideos({
    q,
    maxResults: capped,
    fallbackTitle: recipeName,
  });
}

export async function searchRecipeVideo(
  recipeName: string,
): Promise<YoutubeMatch | null> {
  const list = await searchRecipeVideos(recipeName, 1);
  return list[0] ?? null;
}

/** YouTube search using pantry ingredient names, biased toward Shorts (<4 min + #shorts). */
export async function searchPantryShortsVideos(
  ingredientNames: string[],
  maxResults = 15,
): Promise<YoutubeMatch[]> {
  const unique = [
    ...new Set(
      ingredientNames
        .map((n) => String(n).trim())
        .filter((n) => n.length > 0),
    ),
  ].slice(0, 8);
  if (unique.length === 0) return [];

  const capped = Math.min(Math.max(1, maxResults), 50);
  const q = `${unique.join(" ")} recipe cooking #shorts`;
  return searchVideos({
    q,
    maxResults: capped,
    videoDuration: "short",
    fallbackTitle: unique[0] ?? "Pantry",
  });
}
