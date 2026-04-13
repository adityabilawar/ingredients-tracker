"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookmarkPlus,
  ChefHat,
  Flame,
  Loader2,
  Pencil,
  Search,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Recipe, RecipeIngredient } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
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
import { Skeleton } from "@/components/ui/skeleton";
import { LiftHover, Stagger, FadeItem } from "@/components/motion-primitives";

function RecipeImageLoader({
  title,
  className,
  sizes,
}: {
  title: string;
  className?: string;
  sizes?: string;
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
    />
  );
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

function formatPrep(minutes: number | null) {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function difficultyFromMinutes(minutes: number | null) {
  if (minutes == null) return null;
  if (minutes <= 20) return "Easy";
  if (minutes <= 45) return "Medium";
  return "Deep";
}

type RecipeWithLines = Recipe & {
  recipe_ingredients: RecipeIngredient[] | null;
};

type SuggestResponse =
  | {
      provider: "spoonacular";
      recipes: {
        spoonacularId: number;
        title: string;
        image: string | null;
        usedIngredientCount?: number;
        missedIngredientCount?: number;
      }[];
    }
  | {
      provider: "openai";
      recipes: {
        aiId: string;
        title: string;
        image: null;
        ingredients: string[];
      }[];
    }
  | { provider: "none"; recipes: unknown[]; message?: string };

type PantryOnlyResponse =
  | {
      provider: "spoonacular";
      recipes: {
        spoonacularId: number;
        title: string;
        image: string | null;
        usedIngredientCount: number;
        missedIngredientCount: number;
      }[];
    }
  | {
      provider: "openai";
      recipes: {
        aiId: string;
        title: string;
        image: null;
        ingredients: string[];
      }[];
    }
  | { provider: "none"; recipes: unknown[]; message?: string };

export function RecipesClient() {
  const [suggest, setSuggest] = useState<SuggestResponse | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<
    {
      spoonacularId: number;
      title: string;
      image: string | null;
      readyInMinutes: number | null;
      caloriesPerServing: number | null;
    }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState<RecipeWithLines[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  const [pantryOnly, setPantryOnly] = useState<PantryOnlyResponse | null>(null);
  const [pantryLoading, setPantryLoading] = useState(true);

  const [detail, setDetail] = useState<RecipeWithLines | null>(null);
  const [editLines, setEditLines] = useState("");
  const [editName, setEditName] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLines, setNewLines] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const loadSuggest = useCallback(async () => {
    setSuggestLoading(true);
    try {
      const data = await jsonFetch<SuggestResponse>("/api/recipes/suggest");
      setSuggest(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load suggestions");
    } finally {
      setSuggestLoading(false);
    }
  }, []);

  const loadPantryOnly = useCallback(async () => {
    setPantryLoading(true);
    try {
      const data = await jsonFetch<PantryOnlyResponse>(
        "/api/recipes/pantry-only",
      );
      setPantryOnly(data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load pantry-only recipes",
      );
    } finally {
      setPantryLoading(false);
    }
  }, []);

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const data = await jsonFetch<{ recipes: RecipeWithLines[] }>(
        "/api/recipes",
      );
      const list = (data.recipes ?? []).map((r) => ({
        ...r,
        recipe_ingredients: (r.recipe_ingredients ?? []).sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
      }));
      setSaved(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load recipes");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuggest();
    void loadPantryOnly();
    void loadSaved();
  }, [loadSuggest, loadPantryOnly, loadSaved]);

  async function runSearch() {
    const q = searchQ.trim();
    if (!q) return;
    setSearching(true);
    try {
      const data = await jsonFetch<{
        recipes: {
          spoonacularId: number;
          title: string;
          image: string | null;
          readyInMinutes: number | null;
          caloriesPerServing: number | null;
        }[];
      }>(`/api/recipes/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.recipes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
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
      await loadSaved();
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
      await loadSaved();
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
      await loadSaved();
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
      await loadSaved();
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
      await loadSaved();
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
      await loadSaved();
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
      <Tabs defaultValue="suggested" className="w-full">
        <TabsList className="bg-muted/60 grid h-12 w-full max-w-2xl grid-cols-4 gap-1 rounded-2xl p-1 ring-1 ring-border/60">
          <TabsTrigger
            value="suggested"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-xl font-medium"
          >
            For you
          </TabsTrigger>
          <TabsTrigger
            value="pantry-only"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-xl font-medium"
          >
            Pantry only
          </TabsTrigger>
          <TabsTrigger
            value="search"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-xl font-medium"
          >
            Search
          </TabsTrigger>
          <TabsTrigger
            value="saved"
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-xl font-medium"
          >
            Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggested" className="space-y-6 pt-6">
          {suggestLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[22rem] rounded-2xl" />
              ))}
            </div>
          ) : suggest?.provider === "none" ? (
            <div className="border-terracotta/25 from-herb-muted/30 rounded-2xl border border-dashed bg-gradient-to-br to-transparent px-6 py-12 text-center">
              <ChefHat className="text-muted-foreground mx-auto mb-3 size-10 opacity-50" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                {suggest.message ?? "Add ingredients to see suggestions."}
              </p>
            </div>
          ) : suggest?.provider === "spoonacular" ? (
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggest.recipes.map((r) => {
                const used = r.usedIngredientCount ?? 0;
                const missed = r.missedIngredientCount ?? 0;
                return (
                  <FadeItem key={r.spoonacularId}>
                    <LiftHover>
                      <Card className="group/rec overflow-hidden rounded-2xl border py-0 shadow-md ring-1 ring-black/[0.04] transition-shadow hover:shadow-xl dark:ring-white/[0.06]">
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
                              title={r.title}
                              className="object-cover transition duration-500 group-hover/rec:scale-[1.05]"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
                              Match {used}
                            </span>
                            {missed > 0 ? (
                              <span className="rounded-full border border-terracotta/50 bg-terracotta/95 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                                Shop {missed}
                              </span>
                            ) : null}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            <CardTitle className="font-heading line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow">
                              {r.title}
                            </CardTitle>
                            <CardDescription className="mt-1 text-xs text-white/80">
                              Curated for your pantry
                            </CardDescription>
                          </div>
                        </div>
                        <CardFooter className="border-t border-border/60 bg-muted/25 p-4">
                          <Button
                            size="lg"
                            className="min-h-11 w-full touch-manipulation"
                            onClick={() =>
                              void saveFromSpoonacular(r.spoonacularId, "suggested")
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
              })}
            </Stagger>
          ) : (
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggest?.provider === "openai" &&
                suggest.recipes.map((r) => (
                  <FadeItem key={r.aiId}>
                    <LiftHover>
                      <Card className="group/rec overflow-hidden rounded-2xl border py-0 shadow-md ring-1 ring-black/[0.04] transition-shadow hover:shadow-xl dark:ring-white/[0.06]">
                        <div className="bg-muted relative aspect-[5/4] w-full overflow-hidden sm:aspect-[4/3]">
                          <RecipeImageLoader
                            title={r.title}
                            className="object-cover transition duration-500 group-hover/rec:scale-[1.05]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-violet-400/40 bg-violet-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-50 backdrop-blur-md">
                              AI generated
                            </span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            <CardTitle className="font-heading line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow">
                              {r.title}
                            </CardTitle>
                            <CardDescription className="mt-1 line-clamp-2 text-xs text-white/80">
                              {(r.ingredients ?? []).join(", ")}
                            </CardDescription>
                          </div>
                        </div>
                        <CardFooter className="border-t border-border/60 bg-muted/25 p-4">
                          <Button
                            size="lg"
                            className="min-h-11 w-full touch-manipulation"
                            onClick={() =>
                              void saveFromOpenAI(r.title, r.ingredients ?? [])
                            }
                          >
                            <BookmarkPlus className="size-4" />
                            Save to library
                          </Button>
                        </CardFooter>
                      </Card>
                    </LiftHover>
                  </FadeItem>
                ))}
            </Stagger>
          )}
        </TabsContent>

        <TabsContent value="pantry-only" className="space-y-6 pt-6">
          {pantryLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[22rem] rounded-2xl" />
              ))}
            </div>
          ) : pantryOnly?.provider === "none" ? (
            <div className="border-terracotta/25 from-herb-muted/30 rounded-2xl border border-dashed bg-gradient-to-br to-transparent px-6 py-12 text-center">
              <ChefHat className="text-muted-foreground mx-auto mb-3 size-10 opacity-50" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                {pantryOnly.message ??
                  "Add ingredients or configure recipe APIs to see pantry-only ideas."}
              </p>
            </div>
          ) : pantryOnly?.provider === "spoonacular" ? (
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pantryOnly.recipes.map((r) => {
                const missed = r.missedIngredientCount ?? 0;
                return (
                  <FadeItem key={r.spoonacularId}>
                    <LiftHover>
                      <Card className="group/rec overflow-hidden rounded-2xl border py-0 shadow-md ring-1 ring-black/[0.04] transition-shadow hover:shadow-xl dark:ring-white/[0.06]">
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
                            <CardTitle className="font-heading line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow">
                              {r.title}
                            </CardTitle>
                            <CardDescription className="mt-1 text-xs text-white/80">
                              {missed === 0
                                ? "No shopping needed"
                                : "Mostly from your pantry"}
                            </CardDescription>
                          </div>
                        </div>
                        <CardFooter className="border-t border-border/60 bg-muted/25 p-4">
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
              })}
            </Stagger>
          ) : pantryOnly?.provider === "openai" ? (
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pantryOnly.recipes.map((r) => (
                <FadeItem key={r.aiId}>
                  <LiftHover>
                    <Card className="group/rec overflow-hidden rounded-2xl border py-0 shadow-md ring-1 ring-black/[0.04] transition-shadow hover:shadow-xl dark:ring-white/[0.06]">
                      <div className="bg-muted relative aspect-[5/4] w-full overflow-hidden sm:aspect-[4/3]">
                        <RecipeImageLoader
                          title={r.title}
                          className="object-cover transition duration-500 group-hover/rec:scale-[1.05]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50 backdrop-blur-md">
                            Pantry only
                          </span>
                          <span className="rounded-full border border-violet-400/40 bg-violet-950/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-50 backdrop-blur-md">
                            AI generated
                          </span>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-4">
                          <CardTitle className="font-heading line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow">
                            {r.title}
                          </CardTitle>
                          <CardDescription className="mt-1 line-clamp-2 text-xs text-white/80">
                            {(r.ingredients ?? []).join(", ")}
                          </CardDescription>
                        </div>
                      </div>
                      <CardFooter className="border-t border-border/60 bg-muted/25 p-4">
                        <Button
                          size="lg"
                          className="min-h-11 w-full touch-manipulation"
                          onClick={() =>
                            void saveFromOpenAI(r.title, r.ingredients ?? [])
                          }
                        >
                          <BookmarkPlus className="size-4" />
                          Save to library
                        </Button>
                      </CardFooter>
                    </Card>
                  </LiftHover>
                </FadeItem>
              ))}
            </Stagger>
          ) : null}
        </TabsContent>

        <TabsContent value="search" className="space-y-6 pt-6">
          <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch">
            <Input
              placeholder="Search recipes…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="h-11 min-h-11 flex-1 rounded-xl border-border/80 text-base shadow-sm sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
            />
            <Button
              className="min-h-11 shrink-0 rounded-xl px-6"
              onClick={() => void runSearch()}
              disabled={searching}
            >
              {searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Search
            </Button>
          </div>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {searchResults.map((r) => {
              const prep = formatPrep(r.readyInMinutes);
              const diff = difficultyFromMinutes(r.readyInMinutes);
              const cal = r.caloriesPerServing;
              return (
                <FadeItem key={r.spoonacularId}>
                  <LiftHover>
                    <Card className="group/rec overflow-hidden rounded-2xl border py-0 shadow-md ring-1 ring-black/[0.04] transition-shadow hover:shadow-xl dark:ring-white/[0.06]">
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
                          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                            No image
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                          {prep ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
                              <Timer className="size-3 opacity-90" />
                              {prep}
                            </span>
                          ) : null}
                          {diff ? (
                            <span className="rounded-full border border-emerald-400/40 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50 backdrop-blur-md">
                              {diff}
                            </span>
                          ) : null}
                          {cal != null ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-950/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-50 backdrop-blur-md">
                              <Flame className="size-3 opacity-90" />
                              {cal} kcal
                            </span>
                          ) : null}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-4">
                          <CardTitle className="font-heading line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow">
                            {r.title}
                          </CardTitle>
                        </div>
                      </div>
                      <CardFooter className="border-t border-border/60 bg-muted/25 p-4">
                        <Button
                          size="lg"
                          className="min-h-11 w-full touch-manipulation"
                          onClick={() =>
                            void saveFromSpoonacular(r.spoonacularId, "searched")
                          }
                        >
                          <BookmarkPlus className="size-4" />
                          Save
                        </Button>
                      </CardFooter>
                    </Card>
                  </LiftHover>
                </FadeItem>
              );
            })}
          </Stagger>
        </TabsContent>

        <TabsContent value="saved" className="space-y-6 pt-6">
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="lg" className="min-h-11 rounded-xl" onClick={() => setNewOpen(true)}>
              New recipe
            </Button>
          </div>
          {savedLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : saved.length === 0 ? (
            <div className="border-terracotta/20 from-muted/40 rounded-2xl border border-dashed px-6 py-12 text-center">
              <p className="text-muted-foreground text-sm leading-relaxed">
                No saved recipes yet. Save from suggestions or create your own.
              </p>
            </div>
          ) : (
            <Stagger className="grid gap-4 sm:grid-cols-2">
              {saved.map((r) => {
                const n = (r.recipe_ingredients ?? []).length;
                return (
                  <FadeItem key={r.id}>
                    <LiftHover>
                      <Card className="group/saved overflow-hidden rounded-2xl border py-0 shadow-md ring-1 ring-black/[0.04] transition-shadow hover:shadow-lg dark:ring-white/[0.06]">
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
                            <div className="from-herb-muted/50 flex h-full items-center justify-center bg-gradient-to-br to-terracotta-muted/30">
                              <ChefHat className="text-muted-foreground size-12 opacity-35" />
                            </div>
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
                            <CardTitle className="font-heading pointer-events-none line-clamp-2 text-xl font-semibold text-white drop-shadow-md">
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
        </TabsContent>
      </Tabs>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 sm:max-w-2xl">
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
        <DialogContent className="border-border/80 sm:max-w-md">
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
