"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BookmarkPlus,
  ChefHat,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Recipe, RecipeIngredient } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LiftHover, Stagger, FadeItem } from "@/components/motion-primitives";
import { RecipeImageLoader } from "@/components/recipe-image-loader";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

type RecipeWithLines = Recipe & {
  recipe_ingredients: RecipeIngredient[] | null;
};

type PantryOpenAiCard = {
  aiId: string;
  title: string;
  image: null;
  ingredients: string[];
  cuisine: string;
  meal_type: string;
  description: string;
};

type PantrySpoonacularCard = {
  spoonacularId: number;
  title: string;
  image: string | null;
  usedIngredientCount: number;
  missedIngredientCount: number;
};

type PantryMixedRecipe =
  | ({ type: "openai" } & PantryOpenAiCard)
  | ({ type: "spoonacular" } & PantrySpoonacularCard);

type PantryOnlyResponse =
  | {
      provider: "spoonacular";
      recipes: PantrySpoonacularCard[];
    }
  | {
      provider: "openai";
      recipes: PantryOpenAiCard[];
    }
  | {
      provider: "mixed";
      recipes: PantryMixedRecipe[];
    }
  | { provider: "none"; recipes: unknown[]; message?: string };

const SS_PANTRY_EMPTY = "pantry-os:recipes-pantry-empty-v1";
const SS_SAVED_LIST = "pantry-os:recipes-saved-list-v1";

function readPantryEmptyFromSession(): PantryOnlyResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SS_PANTRY_EMPTY);
    if (!raw) return null;
    return JSON.parse(raw) as PantryOnlyResponse;
  } catch {
    return null;
  }
}

function writePantryEmptyToSession(data: PantryOnlyResponse) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SS_PANTRY_EMPTY, JSON.stringify(data));
  } catch {
    /* quota or private mode */
  }
}

function readSavedListFromSession(): RecipeWithLines[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SS_SAVED_LIST);
    if (!raw) return null;
    return JSON.parse(raw) as RecipeWithLines[];
  } catch {
    return null;
  }
}

function writeSavedListToSession(list: RecipeWithLines[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SS_SAVED_LIST, JSON.stringify(list));
  } catch {
    /* quota or private mode */
  }
}

function isEmptyExcludeList(excludeList: string[]) {
  return excludeList.every((t) => !t.trim());
}

/** Base pantry match (no ?exclude=); reused across visits and tabs in this session. */
let pantryOnlyEmptyCache: PantryOnlyResponse | null = null;
let pantryOnlyEmptyInFlight: Promise<PantryOnlyResponse> | null = null;

/** `null` means we have not successfully loaded the library yet. */
let savedRecipesCache: RecipeWithLines[] | null = null;
let savedRecipesInFlight: Promise<RecipeWithLines[]> | null = null;

function collectPantryTitles(data: PantryOnlyResponse | null): string[] {
  if (!data || data.provider === "none") return [];
  if (data.provider === "spoonacular") {
    return data.recipes.map((r) => r.title);
  }
  if (data.provider === "openai") {
    return data.recipes.map((r) => r.title);
  }
  return data.recipes.map((r) => r.title);
}

function RecipesFetchLoading({ subtitle }: { subtitle: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[min(28rem,calc(100vh-14rem))] flex-col items-center justify-center gap-6 rounded-xl border border-border px-6 py-16"
    >
      <div className="flex size-16 items-center justify-center rounded-xl bg-muted">
        <Loader2
          className="text-primary size-9 animate-spin"
          aria-hidden
        />
      </div>
      <div className="max-w-sm space-y-2 text-center">
        <p className="text-xl font-semibold tracking-tight">
          Loading recipes
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export function RecipesClient() {
  const [saved, setSaved] = useState<RecipeWithLines[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const pantryBootstrappedRef = useRef(false);
  const savedLoadedRef = useRef(false);
  const [activeTab, setActiveTab] = useState("pantry-only");

  const [pantryOnly, setPantryOnly] = useState<PantryOnlyResponse | null>(null);
  const [pantryLoading, setPantryLoading] = useState(true);
  const [excludedPantryTitles, setExcludedPantryTitles] = useState<string[]>(
    [],
  );

  const [detail, setDetail] = useState<RecipeWithLines | null>(null);
  const [editLines, setEditLines] = useState("");
  const [editName, setEditName] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLines, setNewLines] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const loadPantryOnly = useCallback(async (excludeList: string[] = []) => {
    const empty = isEmptyExcludeList(excludeList);

    if (empty) {
      if (!pantryOnlyEmptyCache) {
        const fromSession = readPantryEmptyFromSession();
        if (fromSession) pantryOnlyEmptyCache = fromSession;
      }
      if (pantryOnlyEmptyCache) {
        setPantryOnly(pantryOnlyEmptyCache);
        setPantryLoading(false);
        return;
      }

      setPantryLoading(true);
      try {
        if (!pantryOnlyEmptyInFlight) {
          pantryOnlyEmptyInFlight = jsonFetch<PantryOnlyResponse>(
            "/api/recipes/pantry-only",
          )
            .then((data) => {
              pantryOnlyEmptyCache = data;
              writePantryEmptyToSession(data);
              return data;
            })
            .finally(() => {
              pantryOnlyEmptyInFlight = null;
            });
        }
        const data = await pantryOnlyEmptyInFlight;
        setPantryOnly(data);
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Failed to load pantry-only recipes",
        );
      } finally {
        setPantryLoading(false);
      }
      return;
    }

    setPantryLoading(true);
    try {
      const params = new URLSearchParams();
      for (const t of excludeList) {
        const s = t.trim();
        if (s) params.append("exclude", s);
      }
      const qs = params.toString();
      const url = qs
        ? `/api/recipes/pantry-only?${qs}`
        : "/api/recipes/pantry-only";
      const data = await jsonFetch<PantryOnlyResponse>(url);
      setPantryOnly(data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load pantry-only recipes",
      );
    } finally {
      setPantryLoading(false);
    }
  }, []);

  function showMorePantryIdeas() {
    if (!pantryOnly || pantryOnly.provider === "none") return;
    const seen = collectPantryTitles(pantryOnly);
    const next = [...new Set([...excludedPantryTitles, ...seen])];
    setExcludedPantryTitles(next);
    void loadPantryOnly(next);
  }

  function resetPantryExclusions() {
    setExcludedPantryTitles([]);
    void loadPantryOnly([]);
  }

  const loadSaved = useCallback(async (force = false) => {
    if (!force && savedRecipesCache !== null) {
      setSaved(savedRecipesCache);
      savedLoadedRef.current = true;
      return;
    }

    if (!force) {
      const raw = readSavedListFromSession();
      if (raw) {
        const list = raw.map((r) => ({
          ...r,
          recipe_ingredients: (r.recipe_ingredients ?? []).sort(
            (a, b) => a.sort_order - b.sort_order,
          ),
        }));
        savedRecipesCache = list;
        setSaved(list);
        savedLoadedRef.current = true;
        return;
      }
    }

    setSavedLoading(true);
    try {
      if (!force && savedRecipesInFlight) {
        const list = await savedRecipesInFlight;
        setSaved(list);
        savedLoadedRef.current = true;
        return;
      }

      const run = async () => {
        const data = await jsonFetch<{ recipes: RecipeWithLines[] }>(
          "/api/recipes",
        );
        return (data.recipes ?? []).map((r) => ({
          ...r,
          recipe_ingredients: (r.recipe_ingredients ?? []).sort(
            (a, b) => a.sort_order - b.sort_order,
          ),
        }));
      };

      const pending = run();
      if (!force) {
        savedRecipesInFlight = pending.finally(() => {
          savedRecipesInFlight = null;
        });
      }

      const list = await pending;
      savedRecipesCache = list;
      writeSavedListToSession(list);
      setSaved(list);
      savedLoadedRef.current = true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load recipes");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    if (pantryBootstrappedRef.current) return;
    pantryBootstrappedRef.current = true;
    void loadPantryOnly([]);
  }, [loadPantryOnly]);

  function handleTabChange(value: string) {
    setActiveTab(value);
    if (value === "saved" && !savedLoadedRef.current) {
      void loadSaved();
    }
  }

  async function saveFromSpoonacular(id: number, source: "suggested" | "searched") {
    try {
      await jsonFetch("/api/recipes", {
        method: "POST",
        body: JSON.stringify({
          kind: "spoonacular",
          spoonacularId: id,
          source,
        }),
      });
      toast.success("Recipe saved");
      await loadSaved(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function saveFromOpenAI(title: string, ingredients: string[]) {
    try {
      await jsonFetch("/api/recipes", {
        method: "POST",
        body: JSON.stringify({
          kind: "openai",
          name: title,
          ingredients,
          source: "suggested",
        }),
      });
      toast.success("Recipe saved");
      await loadSaved(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  function openDetail(r: RecipeWithLines) {
    setDetail(r);
    setEditName(r.name);
    setEditLines(
      (r.recipe_ingredients ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => i.name)
        .join("\n"),
    );
  }

  async function saveDetail() {
    if (!detail) return;
    setSavingDetail(true);
    try {
      const ingredients = editLines
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const data = await jsonFetch<{ recipe: RecipeWithLines }>(
        `/api/recipes/${detail.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: editName.trim(),
            ingredients,
            refreshYoutube: false,
          }),
        },
      );
      toast.success("Recipe updated");
      setDetail(data.recipe);
      await loadSaved(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingDetail(false);
    }
  }

  async function refreshYoutube() {
    if (!detail) return;
    setSavingDetail(true);
    try {
      const data = await jsonFetch<{ recipe: RecipeWithLines }>(
        `/api/recipes/${detail.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ refreshYoutube: true }),
        },
      );
      toast.success("YouTube link refreshed");
      setDetail(data.recipe);
      await loadSaved(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setSavingDetail(false);
    }
  }

  async function deleteRecipe(id: string) {
    try {
      await jsonFetch(`/api/recipes/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      setDetail((d) => (d?.id === id ? null : d));
      await loadSaved(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function createCustom() {
    const name = newName.trim();
    if (!name) return;
    setSavingNew(true);
    try {
      const ingredients = newLines
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await jsonFetch("/api/recipes", {
        method: "POST",
        body: JSON.stringify({
          kind: "custom",
          name,
          ingredients,
          source: "custom",
        }),
      });
      toast.success("Recipe created");
      setNewOpen(false);
      setNewName("");
      setNewLines("");
      await loadSaved(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSavingNew(false);
    }
  }

  const embedUrl = useMemo(() => {
    const id = detail?.youtube_video_id;
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }, [detail?.youtube_video_id]);

  return (
    <div className="space-y-8 md:space-y-10">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="bg-muted grid h-11 w-full max-w-md grid-cols-2 gap-1 rounded-lg p-1">
          <TabsTrigger
            value="pantry-only"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md font-medium"
          >
            From pantry
          </TabsTrigger>
          <TabsTrigger
            value="saved"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md font-medium"
          >
            Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pantry-only" className="space-y-6 pt-6">
          {pantryLoading ? (
            <RecipesFetchLoading subtitle="Matching your pantry to ideas from the recipe APIs…" />
          ) : !pantryOnly ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <ChefHat className="text-muted-foreground mx-auto mb-3 size-10 opacity-50" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                Could not load pantry ideas. Try again.
              </p>
            </div>
          ) : pantryOnly.provider === "none" ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <ChefHat className="text-muted-foreground mx-auto mb-3 size-10 opacity-50" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                {pantryOnly.message ??
                  "Add ingredients or configure recipe APIs to see pantry-only ideas."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground max-w-xl text-sm">
                  Ideas use your pantry plus assumed seasonings and oils. AI picks
                  diverse cuisines; Spoonacular matches may appear at the end
                  when both APIs are on.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="min-h-11 rounded-xl"
                    disabled={pantryLoading}
                    onClick={() => resetPantryExclusions()}
                  >
                    Start over
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-11 rounded-xl"
                    disabled={pantryLoading}
                    onClick={() => showMorePantryIdeas()}
                  >
                    <RefreshCw className="size-4" />
                    Show me more
                  </Button>
                </div>
              </div>
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pantryOnly.provider === "spoonacular"
                  ? pantryOnly.recipes.map((r) => {
                      const missed = r.missedIngredientCount ?? 0;
                      return (
                        <FadeItem key={r.spoonacularId}>
                          <LiftHover>
                            <Card className="group/rec overflow-hidden rounded-2xl border py-0 shadow-md transition-shadow hover:shadow-lg">
                              <div className="bg-muted relative aspect-[5/4] w-full overflow-hidden sm:aspect-[4/3]">
                                {r.image ? (
                                  <Image
                                    src={r.image}
                                    alt=""
                                    fill
                                    className="object-cover transition duration-500 group-hover/rec:scale-[1.05]"
                                    sizes="(max-width:1024px) 50vw, 33vw"
                                  />
                                ) : (
                                  <RecipeImageLoader
                                    key={`sp-${r.spoonacularId}`}
                                    title={r.title}
                                    className="object-cover transition duration-500 group-hover/rec:scale-[1.05]"
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                                  <span className="rounded-full border border-emerald-400/40 bg-emerald-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50 backdrop-blur-md">
                                    {r.usedIngredientCount} of your ingredients
                                  </span>
                                  {missed > 0 ? (
                                    <span className="rounded-full border border-amber-400/50 bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-50 backdrop-blur-md">
                                      +{missed} extra{missed === 1 ? "" : "s"}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                  <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow">
                                    {r.title}
                                  </CardTitle>
                                  <CardDescription className="mt-1 text-xs text-white/80">
                                    {missed === 0
                                      ? "No shopping needed"
                                      : "Mostly from your pantry"}
                                  </CardDescription>
                                </div>
                              </div>
                              <CardFooter className="border-t border-border p-4">
                                <Button
                                  size="lg"
                                  className="min-h-11 w-full touch-manipulation"
                                  onClick={() =>
                                    void saveFromSpoonacular(
                                      r.spoonacularId,
                                      "suggested",
                                    )
                                  }
                                >
                                  <BookmarkPlus className="size-4" />
                                  Save to library
                                </Button>
                              </CardFooter>
                            </Card>
                          </LiftHover>
                        </FadeItem>
                      );
                    })
                  : pantryOnly.provider === "openai"
                    ? pantryOnly.recipes.map((r) => (
                        <FadeItem key={r.aiId}>
                          <LiftHover>
                            <Card className="group/rec overflow-hidden rounded-2xl border py-0 shadow-md transition-shadow hover:shadow-lg">
                              <div className="bg-muted relative aspect-[5/4] w-full overflow-hidden sm:aspect-[4/3]">
                                <RecipeImageLoader
                                  key={r.aiId}
                                  title={r.title}
                                  className="object-cover transition duration-500 group-hover/rec:scale-[1.05]"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                                <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
                                  <span className="rounded-full border border-emerald-400/40 bg-emerald-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50 backdrop-blur-md">
                                    Pantry
                                  </span>
                                  <span className="rounded-full border border-sky-400/40 bg-sky-950/50 px-2.5 py-0.5 text-[10px] font-semibold capitalize tracking-wide text-sky-50 backdrop-blur-md">
                                    {r.cuisine}
                                  </span>
                                  <span className="rounded-full border border-amber-400/40 bg-amber-950/50 px-2.5 py-0.5 text-[10px] font-semibold capitalize tracking-wide text-amber-50 backdrop-blur-md">
                                    {r.meal_type}
                                  </span>
                                  <span className="rounded-full border border-violet-400/40 bg-violet-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-50 backdrop-blur-md">
                                    AI
                                  </span>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                  <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow">
                                    {r.title}
                                  </CardTitle>
                                  <CardDescription className="mt-1 line-clamp-3 text-xs text-white/85">
                                    {r.description?.trim()
                                      ? r.description
                                      : (r.ingredients ?? []).join(", ")}
                                  </CardDescription>
                                </div>
                              </div>
                              <CardFooter className="border-t border-border p-4">
                                <Button
                                  size="lg"
                                  className="min-h-11 w-full touch-manipulation"
                                  onClick={() =>
                                    void saveFromOpenAI(
                                      r.title,
                                      r.ingredients ?? [],
                                    )
                                  }
                                >
                                  <BookmarkPlus className="size-4" />
                                  Save to library
                                </Button>
                              </CardFooter>
                            </Card>
                          </LiftHover>
                        </FadeItem>
                      ))
                    : pantryOnly.recipes.map((r) =>
                        r.type === "spoonacular" ? (
                          <FadeItem key={`sp-${r.spoonacularId}`}>
                            <LiftHover>
                              <Card className="group/rec overflow-hidden rounded-2xl border py-0 shadow-md transition-shadow hover:shadow-lg">
                                <div className="bg-muted relative aspect-[5/4] w-full overflow-hidden sm:aspect-[4/3]">
                                  {r.image ? (
                                    <Image
                                      src={r.image}
                                      alt=""
                                      fill
                                      className="object-cover transition duration-500 group-hover/rec:scale-[1.05]"
                                      sizes="(max-width:1024px) 50vw, 33vw"
                                    />
                                  ) : (
                                    <RecipeImageLoader
                                      key={`sp-${r.spoonacularId}`}
                                      title={r.title}
                                      className="object-cover transition duration-500 group-hover/rec:scale-[1.05]"
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                                    <span className="rounded-full border border-cyan-400/40 bg-cyan-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-50 backdrop-blur-md">
                                      Spoonacular
                                    </span>
                                    <span className="rounded-full border border-emerald-400/40 bg-emerald-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50 backdrop-blur-md">
                                      {r.usedIngredientCount} matched
                                    </span>
                                    {(r.missedIngredientCount ?? 0) > 0 ? (
                                      <span className="rounded-full border border-amber-400/50 bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-50 backdrop-blur-md">
                                        +{r.missedIngredientCount} extra
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 p-4">
                                    <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow">
                                      {r.title}
                                    </CardTitle>
                                    <CardDescription className="mt-1 text-xs text-white/80">
                                      From recipe database
                                    </CardDescription>
                                  </div>
                                </div>
                                <CardFooter className="border-t border-border p-4">
                                  <Button
                                    size="lg"
                                    className="min-h-11 w-full touch-manipulation"
                                    onClick={() =>
                                      void saveFromSpoonacular(
                                        r.spoonacularId,
                                        "suggested",
                                      )
                                    }
                                  >
                                    <BookmarkPlus className="size-4" />
                                    Save to library
                                  </Button>
                                </CardFooter>
                              </Card>
                            </LiftHover>
                          </FadeItem>
                        ) : (
                          <FadeItem key={r.aiId}>
                            <LiftHover>
                              <Card className="group/rec overflow-hidden rounded-2xl border py-0 shadow-md transition-shadow hover:shadow-lg">
                                <div className="bg-muted relative aspect-[5/4] w-full overflow-hidden sm:aspect-[4/3]">
                                  <RecipeImageLoader
                                    key={r.aiId}
                                    title={r.title}
                                    className="object-cover transition duration-500 group-hover/rec:scale-[1.05]"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                                  <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
                                    <span className="rounded-full border border-emerald-400/40 bg-emerald-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50 backdrop-blur-md">
                                      Pantry
                                    </span>
                                    <span className="rounded-full border border-sky-400/40 bg-sky-950/50 px-2.5 py-0.5 text-[10px] font-semibold capitalize tracking-wide text-sky-50 backdrop-blur-md">
                                      {r.cuisine}
                                    </span>
                                    <span className="rounded-full border border-amber-400/40 bg-amber-950/50 px-2.5 py-0.5 text-[10px] font-semibold capitalize tracking-wide text-amber-50 backdrop-blur-md">
                                      {r.meal_type}
                                    </span>
                                    <span className="rounded-full border border-violet-400/40 bg-violet-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-50 backdrop-blur-md">
                                      AI
                                    </span>
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 p-4">
                                    <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow">
                                      {r.title}
                                    </CardTitle>
                                    <CardDescription className="mt-1 line-clamp-3 text-xs text-white/85">
                                      {r.description?.trim()
                                        ? r.description
                                        : (r.ingredients ?? []).join(", ")}
                                    </CardDescription>
                                  </div>
                                </div>
                                <CardFooter className="border-t border-border p-4">
                                  <Button
                                    size="lg"
                                    className="min-h-11 w-full touch-manipulation"
                                    onClick={() =>
                                      void saveFromOpenAI(
                                        r.title,
                                        r.ingredients ?? [],
                                      )
                                    }
                                  >
                                    <BookmarkPlus className="size-4" />
                                    Save to library
                                  </Button>
                                </CardFooter>
                              </Card>
                            </LiftHover>
                          </FadeItem>
                        ),
                      )}
              </Stagger>
            </>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-6 pt-6">
          {activeTab !== "saved" ? null : (
            <>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="lg" className="min-h-11 rounded-xl" onClick={() => setNewOpen(true)}>
              New recipe
            </Button>
          </div>
          {savedLoading ? (
            <RecipesFetchLoading subtitle="Fetching your saved library…" />
          ) : saved.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <p className="text-muted-foreground text-sm leading-relaxed">
                No saved recipes yet. Save a match from Pantry, or use New recipe.
              </p>
            </div>
          ) : (
            <Stagger className="grid gap-4 sm:grid-cols-2">
              {saved.map((r) => {
                const n = (r.recipe_ingredients ?? []).length;
                return (
                  <FadeItem key={r.id}>
                    <LiftHover>
                      <Card className="group/saved overflow-hidden rounded-xl border border-border py-0 transition-shadow hover:shadow-md">
                        <div className="bg-muted relative aspect-[16/10] w-full overflow-hidden">
                          <Link
                            href={`/recipes/${r.id}`}
                            className="absolute inset-0 z-[1]"
                            aria-label={`View recipe: ${r.name}`}
                          />
                          {r.thumbnail_url ? (
                            <Image
                              src={r.thumbnail_url}
                              alt=""
                              fill
                              className="object-cover transition duration-500 group-hover/saved:scale-[1.04]"
                              sizes="(max-width:768px) 100vw, 50vw"
                              unoptimized={
                                r.thumbnail_url.includes("placehold.co") ||
                                r.thumbnail_url.startsWith("data:")
                              }
                            />
                          ) : (
                            <RecipeImageLoader
                              key={r.id}
                              recipeId={r.id}
                              title={r.name}
                              className="object-cover transition duration-500 group-hover/saved:scale-[1.04]"
                              sizes="(max-width:768px) 100vw, 50vw"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />
                          <div className="absolute right-2 top-2 z-20 flex gap-1">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="size-10 min-h-10 min-w-10 rounded-full border border-white/30 bg-white/90 text-foreground shadow-md backdrop-blur hover:bg-white dark:bg-black/60 dark:text-white"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openDetail(r);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="size-10 min-h-10 min-w-10 rounded-full border border-white/30 bg-white/90 text-destructive shadow-md backdrop-blur hover:bg-white dark:bg-black/60"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void deleteRecipe(r.id);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-white/25 bg-black/35 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
                              {n} ingredients
                            </span>
                            <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold capitalize tracking-wide text-white backdrop-blur-md">
                              {r.source}
                            </span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 z-10 p-4 pt-12">
                            <CardTitle className="pointer-events-none line-clamp-2 text-xl font-semibold text-white drop-shadow-md">
                              {r.name}
                            </CardTitle>
                            <Link
                              href={`/recipes/${r.id}`}
                              className="relative z-20 mt-2 inline-block text-xs font-medium text-white/90 underline-offset-4 hover:underline"
                            >
                              View recipe
                            </Link>
                            <span className="text-white/50 mx-1.5 text-xs">·</span>
                            <button
                              type="button"
                              className="relative z-20 text-left text-xs font-medium text-white/90 underline-offset-4 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openDetail(r);
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </Card>
                    </LiftHover>
                  </FadeItem>
                );
              })}
            </Stagger>
          )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit recipe</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="rec-name">Name</Label>
                  <Input
                    id="rec-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rec-ing">Ingredients (one per line)</Label>
                  <Textarea
                    id="rec-ing"
                    rows={8}
                    value={editLines}
                    onChange={(e) => setEditLines(e.target.value)}
                  />
                </div>
                {embedUrl ? (
                  <div className="space-y-2">
                    <Label>Similar video</Label>
                    <div className="aspect-video w-full overflow-hidden rounded-lg border">
                      <iframe
                        title="YouTube"
                        className="h-full w-full"
                        src={embedUrl}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <DialogFooter
                className={
                  embedUrl
                    ? "flex flex-wrap gap-2 sm:justify-between"
                    : "flex flex-wrap justify-end gap-2"
                }
              >
                {embedUrl ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void refreshYoutube()}
                    disabled={savingDetail}
                  >
                    Refresh YouTube match
                  </Button>
                ) : null}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDetail(null)}>
                    Close
                  </Button>
                  <Button
                    disabled={savingDetail || !editName.trim()}
                    onClick={() => void saveDetail()}
                  >
                    {savingDetail ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New recipe</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-ing">Ingredients (one per line)</Label>
              <Textarea
                id="new-ing"
                rows={6}
                value={newLines}
                onChange={(e) => setNewLines(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={savingNew || !newName.trim()}
              onClick={() => void createCustom()}
            >
              {savingNew ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
