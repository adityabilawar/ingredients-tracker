import { getServerEnv } from "@/lib/env";

export type YoutubeMatch = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  url: string;
};

export async function searchRecipeVideo(
  recipeName: string,
): Promise<YoutubeMatch | null> {
  let key: string | undefined;
  try {
    key = getServerEnv().YOUTUBE_API_KEY;
  } catch {
    return null;
  }
  if (!key) return null;

  const q = `${recipeName} recipe cooking`;
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("q", q);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: { title?: string; thumbnails?: { high?: { url?: string } } };
    }[];
  };
  const item = data.items?.[0];
  const videoId = item?.id?.videoId;
  if (!videoId) return null;
  const title = item?.snippet?.title ?? recipeName;
  const thumb =
    item?.snippet?.thumbnails?.high?.url ??
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return {
    videoId,
    title,
    thumbnailUrl: thumb,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
