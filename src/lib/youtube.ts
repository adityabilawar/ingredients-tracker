import { getServerEnv } from "@/lib/env";

/** Each YouTube Data API `search.list` call costs 100 quota units — keep scenario counts bounded. */
const PANTRY_SHORTS_WIDE_K = 8;
const PANTRY_SHORTS_MAX_NAMES = 48;
const PANTRY_SHORTS_RESULTS_PER_CALL = 5;
const PANTRY_SHORTS_MAX_FINAL_VIDEOS = 50;
const PANTRY_SHORTS_DEFAULT_MAX_SEARCHES = 12;
const PANTRY_SHORTS_ABS_MAX_SEARCHES = 14;
const PANTRY_SHORTS_CONCURRENCY = 3;
const PANTRY_SHORTS_MAX_WIDE = 2;
const PANTRY_SHORTS_MAX_SINGLES = 4;
const PANTRY_SHORTS_MAX_PAIRS = 3;
const PANTRY_SHORTS_MAX_TRIPLES = 2;
const PANTRY_SHORTS_MAX_QUINTS = 1;

export type YoutubeMatch = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  url: string;
  channelTitle?: string;
  /** Pantry Shorts only: which ingredient combo produced this hit. */
  searchLabel?: string;
};

export type SearchPantryShortsDiverseOptions = {
  /** e.g. user id — with UTC date seeds deterministic daily shuffle */
  seedSalt?: string;
  maxVideos?: number;
  maxSearches?: number;
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

type PantryShortsScenario = {
  terms: string[];
  label: string;
  maxResults: number;
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

function normalizePantryNames(ingredientNames: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of ingredientNames) {
    const t = String(n).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.slice(0, PANTRY_SHORTS_MAX_NAMES);
}

/** FNV-1a 32-bit — deterministic seed from strings */
function hashStringsToSeed(parts: string[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0;
  }
  return h >>> 0;
}

function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

function buildScenarios(
  names: string[],
  rng: () => number,
  maxSearches: number,
): PantryShortsScenario[] {
  const scenarios: PantryShortsScenario[] = [];
  const n = names.length;
  if (n === 0) return [];

  const shuffled = [...names];
  shuffleInPlace(shuffled, rng);
  const per = PANTRY_SHORTS_RESULTS_PER_CALL;

  const push = (s: PantryShortsScenario) => {
    if (scenarios.length >= maxSearches) return;
    if (s.terms.length === 0) return;
    scenarios.push(s);
  };

  const K = Math.min(PANTRY_SHORTS_WIDE_K, n);
  push({
    terms: shuffled.slice(0, K),
    label: shuffled.slice(0, K).join(" · "),
    maxResults: per,
  });

  if (n > K) {
    const rotated = [...shuffled.slice(K), ...shuffled.slice(0, K)].slice(0, K);
    if (rotated.length === K && scenarios.length < PANTRY_SHORTS_MAX_WIDE) {
      push({
        terms: rotated,
        label: rotated.join(" · "),
        maxResults: per,
      });
    }
  }

  const maxSingles = Math.min(PANTRY_SHORTS_MAX_SINGLES, n);
  for (let i = 0; i < maxSingles; i++) {
    const term = shuffled[i % n]!;
    push({ terms: [term], label: term, maxResults: Math.min(4, per) });
  }

  if (n >= 2) {
    const seenPair = new Set<string>();
    let attempts = 0;
    while (
      scenarios.length < maxSearches &&
      seenPair.size < PANTRY_SHORTS_MAX_PAIRS &&
      attempts < 80
    ) {
      attempts++;
      let i = Math.floor(rng() * n);
      let j = Math.floor(rng() * n);
      if (i === j) continue;
      if (i > j) [i, j] = [j, i];
      const key = `${i}-${j}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      const a = shuffled[i]!;
      const b = shuffled[j]!;
      push({ terms: [a, b], label: `${a} · ${b}`, maxResults: per });
    }
  }

  if (n >= 3) {
    let added = 0;
    let attempts = 0;
    const seen = new Set<string>();
    while (
      added < PANTRY_SHORTS_MAX_TRIPLES &&
      scenarios.length < maxSearches &&
      attempts < 120
    ) {
      attempts++;
      const idx = new Set<number>();
      while (idx.size < 3) idx.add(Math.floor(rng() * n));
      const tri = [...idx].sort((a, b) => a - b);
      const key = tri.join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      const terms = tri.map((k) => shuffled[k]!);
      push({ terms, label: terms.join(" · "), maxResults: per });
      added++;
    }
  }

  if (n >= 5) {
    let added = 0;
    let attempts = 0;
    const seen = new Set<string>();
    while (
      added < PANTRY_SHORTS_MAX_QUINTS &&
      scenarios.length < maxSearches &&
      attempts < 200
    ) {
      attempts++;
      const idx = new Set<number>();
      while (idx.size < 5) idx.add(Math.floor(rng() * n));
      const qu = [...idx].sort((a, b) => a - b);
      const key = qu.join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      const terms = qu.map((k) => shuffled[k]!);
      push({ terms, label: terms.join(" · "), maxResults: per });
      added++;
    }
  }

  return scenarios.slice(0, maxSearches);
}

async function runScenario(
  s: PantryShortsScenario,
): Promise<YoutubeMatch[]> {
  const q = `${s.terms.join(" ")} recipe cooking #shorts`;
  const list = await searchVideos({
    q,
    maxResults: s.maxResults,
    videoDuration: "short",
    fallbackTitle: s.terms[0] ?? "Pantry",
  });
  const label = s.label;
  for (const m of list) {
    m.searchLabel = label;
  }
  return list;
}

/** Run searches in fixed order; at most `concurrency` in flight per batch. */
async function runScenariosOrdered(
  scenarios: PantryShortsScenario[],
  concurrency: number,
): Promise<YoutubeMatch[][]> {
  const batches: YoutubeMatch[][] = [];
  for (let i = 0; i < scenarios.length; i += concurrency) {
    const chunk = scenarios.slice(i, i + concurrency);
    const part = await Promise.all(chunk.map((s) => runScenario(s)));
    batches.push(...part);
  }
  return batches;
}

function mergeDedupeOrdered(
  batches: YoutubeMatch[][],
  maxVideos: number,
): YoutubeMatch[] {
  const seen = new Set<string>();
  const out: YoutubeMatch[] = [];
  for (const batch of batches) {
    for (const m of batch) {
      if (seen.has(m.videoId)) continue;
      seen.add(m.videoId);
      out.push(m);
      if (out.length >= maxVideos) return out;
    }
  }
  return out;
}

/**
 * Multiple pantry-based Shorts searches (singles, pairs, groups) merged and
 * deduped by video id. Bounded API usage — see constants at top of this file.
 */
export async function searchPantryShortsVideosDiverse(
  ingredientNames: string[],
  options?: SearchPantryShortsDiverseOptions,
): Promise<YoutubeMatch[]> {
  const names = normalizePantryNames(ingredientNames);
  if (names.length === 0) return [];

  const maxVideos = Math.min(
    PANTRY_SHORTS_MAX_FINAL_VIDEOS,
    Math.max(1, options?.maxVideos ?? PANTRY_SHORTS_MAX_FINAL_VIDEOS),
  );
  const maxSearches = Math.min(
    PANTRY_SHORTS_ABS_MAX_SEARCHES,
    Math.max(1, options?.maxSearches ?? PANTRY_SHORTS_DEFAULT_MAX_SEARCHES),
  );

  const seed = hashStringsToSeed([
    options?.seedSalt ?? "",
    utcDateKey(),
    String(names.length),
    ...names.slice(0, 8),
  ]);
  const rng = mulberry32(seed);
  const scenarios = buildScenarios(names, rng, maxSearches);
  if (scenarios.length === 0) return [];

  const batches = await runScenariosOrdered(
    scenarios,
    PANTRY_SHORTS_CONCURRENCY,
  );
  return mergeDedupeOrdered(batches, maxVideos);
}

/** Single-query Shorts search (up to 8 terms). Prefer `searchPantryShortsVideosDiverse` for the home feed. */
export async function searchPantryShortsVideos(
  ingredientNames: string[],
  maxResults = 15,
): Promise<YoutubeMatch[]> {
  const names = normalizePantryNames(ingredientNames).slice(0, 8);
  if (names.length === 0) return [];

  const capped = Math.min(Math.max(1, maxResults), 50);
  const q = `${names.join(" ")} recipe cooking #shorts`;
  const list = await searchVideos({
    q,
    maxResults: capped,
    videoDuration: "short",
    fallbackTitle: names[0] ?? "Pantry",
  });
  const label = names.join(" · ");
  for (const m of list) m.searchLabel = label;
  return list;
}
