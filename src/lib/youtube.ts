import { getServerEnv } from "@/lib/env";

export type YoutubeMatch = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  url: string;
};

function parseSearchItems(
  recipeName: string,
  items:
    | {
        id?: { videoId?: string };
        snippet?: { title?: string; thumbnails?: { high?: { url?: string } } };
      }[]
    | undefined,
): YoutubeMatch[] {
  if (!items?.length) return [];
  const out: YoutubeMatch[] = [];
  for (const item of items) {
    const videoId = item?.id?.videoId;
    if (!videoId) continue;
    const title = item?.snippet?.title ?? recipeName;
    const thumb =
      item?.snippet?.thumbnails?.high?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    out.push({
      videoId,
      title,
      thumbnailUrl: thumb,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }
  return out;
}

export async function searchRecipeVideos(
  recipeName: string,
  maxResults = 6,
): Promise<YoutubeMatch[]> {
  let key: string | undefined;
  try {
    key = getServerEnv().YOUTUBE_API_KEY;
  } catch {
    return [];
  }
  if (!key) return [];

  const capped = Math.min(Math.max(1, maxResults), 50);
  const q = `${recipeName} recipe cooking`;
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(capped));
  url.searchParams.set("q", q);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: { title?: string; thumbnails?: { high?: { url?: string } } };
    }[];
  };
  return parseSearchItems(recipeName, data.items);
}

export async function searchRecipeVideo(
  recipeName: string,
): Promise<YoutubeMatch | null> {
  const list = await searchRecipeVideos(recipeName, 1);
  return list[0] ?? null;
}
