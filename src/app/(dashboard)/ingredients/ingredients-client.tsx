"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Package, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Ingredient } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptScanner } from "@/components/receipt-scanner";
import { LiftHover, Stagger, FadeItem } from "@/components/motion-primitives";
import { cn } from "@/lib/utils";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

export function IngredientsClient() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jsonFetch<{ ingredients: Ingredient[] }>(
        "/api/ingredients",
      );
      setItems(data.ingredients);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addIngredient() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await jsonFetch<{ ingredient: Ingredient }>("/api/ingredients", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      toast.success("Ingredient added");
      setName("");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await jsonFetch(`/api/ingredients/${id}`, { method: "DELETE" });
      toast.success("Removed");
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {!loading && (
            <>
              <span className="text-foreground font-medium tabular-nums">
                {items.length}
              </span>{" "}
              {items.length === 1 ? "item" : "items"} in inventory
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            className="min-h-11 touch-manipulation shadow-sm"
            onClick={() => setScanOpen(true)}
          >
            <Receipt className="size-4" />
            Scan receipt
          </Button>
          <ReceiptScanner
            open={scanOpen}
            onOpenChange={setScanOpen}
            onItemsAdded={load}
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <Button
              type="button"
              size="lg"
              className="min-h-11 touch-manipulation shadow-sm"
              onClick={() => setOpen(true)}
            >
              <Plus className="size-4" />
              Add ingredient
            </Button>
            <DialogContent className="border-border/80 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New ingredient</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2 py-2">
                <Label htmlFor="ing-name">Name</Label>
                <Input
                  id="ing-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Greek yogurt"
                  className="h-11"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addIngredient();
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={saving || !name.trim()} onClick={() => void addIngredient()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border-terracotta/20 from-herb-muted/40 flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-gradient-to-b to-transparent px-6 py-16 text-center">
          <div className="bg-background/80 text-terracotta flex size-14 items-center justify-center rounded-2xl border shadow-sm">
            <Package className="size-7" />
          </div>
          <div className="max-w-sm space-y-2">
            <p className="font-heading text-lg font-semibold">No ingredients yet</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Add what you have so pantry-based recipes can match your kitchen.
            </p>
          </div>
          <Button size="lg" className="min-h-11" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add ingredient
          </Button>
        </div>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ing) => {
            const needsVisual = !ing.image_url;
            return (
              <FadeItem key={ing.id}>
                <LiftHover>
                  <Card
                    className={cn(
                      "group/card overflow-hidden rounded-2xl border py-0 shadow-sm ring-1 ring-black/[0.03] transition-shadow duration-300 hover:shadow-lg dark:ring-white/[0.05]",
                      needsVisual && "border-l-4 border-l-terracotta",
                    )}
                  >
                    <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
                      {ing.image_url ? (
                        <Image
                          src={ing.image_url}
                          alt=""
                          fill
                          className="object-cover transition-transform duration-500 group-hover/card:scale-[1.04]"
                          sizes="(max-width:768px) 100vw, 33vw"
                          unoptimized={
                            ing.image_url.includes("placehold.co") ||
                            ing.image_url.startsWith("data:")
                          }
                        />
                      ) : (
                        <div className="from-muted flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br to-terracotta-muted/40 p-6 text-center">
                          <Package className="text-muted-foreground size-8 opacity-40" />
                          <span className="text-muted-foreground text-xs font-medium">
                            No photo yet
                          </span>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-90" />
                      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-4">
                        <h2 className="font-heading line-clamp-2 text-lg font-semibold leading-tight text-white drop-shadow-md">
                          {ing.name}
                        </h2>
                      </div>
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
                          ×1 stocked
                        </span>
                        {needsVisual ? (
                          <span className="rounded-full border border-terracotta/40 bg-terracotta/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                            Add photo
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <CardFooter className="border-t border-border/60 bg-muted/30 p-4">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="min-h-10 w-full touch-manipulation sm:w-auto"
                        onClick={() => void remove(ing.id)}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    </CardFooter>
                  </Card>
                </LiftHover>
              </FadeItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
