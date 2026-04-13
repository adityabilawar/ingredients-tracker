"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Recipe } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type Entry = {
  id: string;
  date: string;
  meal_type: MealType;
  recipe_id: string;
  recipes: Recipe | null;
};

function startOfWeekMonday(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function MealPlanClient() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState<{
    date: string;
    meal: MealType;
  } | null>(null);
  const [recipeId, setRecipeId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const monday = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday],
  );

  const from = fmt(days[0]!);
  const to = fmt(days[6]!);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eData, rData] = await Promise.all([
        jsonFetch<{ entries: Entry[] }>(
          `/api/meal-plan?from=${from}&to=${to}`,
        ),
        jsonFetch<{ recipes: Recipe[] }>("/api/recipes"),
      ]);
      setEntries(eData.entries);
      setRecipes(rData.recipes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function entryFor(date: string, meal: MealType) {
    return entries.find((e) => e.date === date && e.meal_type === meal);
  }

  async function assign() {
    if (!picker || !recipeId) return;
    setSaving(true);
    try {
      await jsonFetch("/api/meal-plan", {
        method: "POST",
        body: JSON.stringify({
          recipeId,
          date: picker.date,
          mealType: picker.meal,
        }),
      });
      toast.success("Meal scheduled");
      setPicker(null);
      setRecipeId("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearEntry(id: string) {
    try {
      await jsonFetch(`/api/meal-plan/${id}`, { method: "DELETE" });
      toast.success("Cleared");
      setEntries((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11 min-h-11 min-w-11 rounded-xl"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 min-h-11 min-w-11 rounded-xl"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="min-h-11 rounded-xl"
            onClick={() => setWeekOffset(0)}
          >
            This week
          </Button>
        </div>
        <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <CalendarDays className="size-4 shrink-0 opacity-70" />
          <span className="font-medium tabular-nums text-foreground">{from}</span>
          <span className="opacity-40">→</span>
          <span className="font-medium tabular-nums text-foreground">{to}</span>
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-[28rem] w-full rounded-2xl" />
      ) : recipes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Save at least one recipe before planning meals.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card p-2">
          <div className="grid min-w-[760px] grid-cols-8 gap-2.5 p-2 text-sm">
            <div className="text-muted-foreground flex items-end p-2 pb-3 text-xs font-semibold uppercase tracking-wide">
              Meal
            </div>
            {days.map((d) => (
              <div
                key={fmt(d)}
                className="rounded-lg border border-border bg-muted p-2 text-center"
              >
                <div className="text-sm font-semibold">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {d.toLocaleDateString(undefined, {
                    month: "numeric",
                    day: "numeric",
                  })}
                </div>
              </div>
            ))}
            {MEALS.map((meal) => (
              <Fragment key={meal}>
                <div className="bg-muted text-foreground flex items-center rounded-lg px-3 py-4 text-xs font-semibold capitalize tracking-wide">
                  {meal}
                </div>
                {days.map((d) => {
                  const dateStr = fmt(d);
                  const e = entryFor(dateStr, meal);
                  const thumb = e?.recipes?.thumbnail_url;
                  return (
                    <Card
                      key={`${dateStr}-${meal}`}
                      className="h-full overflow-hidden rounded-lg border-border py-0 transition-shadow hover:shadow-sm"
                    >
                      <CardHeader className="space-y-2 p-2.5">
                        {e ? (
                          <>
                            <div className="bg-muted relative aspect-[5/3] w-full overflow-hidden rounded-lg">
                              {thumb ? (
                                <Image
                                  src={thumb}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="120px"
                                  unoptimized={
                                    thumb.includes("placehold.co") ||
                                    thumb.startsWith("data:")
                                  }
                                />
                              ) : (
                                <div className="text-muted-foreground flex h-full items-center justify-center text-[10px]">
                                  No photo
                                </div>
                              )}
                            </div>
                            <CardTitle className="line-clamp-2 text-xs font-semibold leading-snug">
                              {e.recipes?.name ?? "Recipe"}
                            </CardTitle>
                            <CardDescription className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 min-h-9 flex-1 rounded-lg text-[11px]"
                                onClick={() =>
                                  setPicker({ date: dateStr, meal })
                                }
                              >
                                Change
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-9 min-h-9 min-w-9 shrink-0 rounded-lg"
                                onClick={() => void clearEntry(e.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </CardDescription>
                          </>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-24 w-full flex-col gap-1 rounded-lg border border-dashed border-border text-xs font-medium"
                            onClick={() => setPicker({ date: dateStr, meal })}
                          >
                            <span className="text-lg leading-none">+</span>
                            Add meal
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent className="hidden p-0" />
                    </Card>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign recipe</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Recipe</Label>
            <Select
              value={recipeId}
              onValueChange={(v) => setRecipeId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a saved recipe" />
              </SelectTrigger>
              <SelectContent>
                {recipes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicker(null)}>
              Cancel
            </Button>
            <Button
              disabled={!recipeId || saving}
              onClick={() => void assign()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
