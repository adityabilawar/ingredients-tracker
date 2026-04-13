"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Minus,
  Pencil,
  Pill,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Supplement, SupplementLog } from "@/types/database";
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

export function SupplementsClient() {
  const [items, setItems] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<Pick<SupplementLog, "id" | "supplement_id">[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplement | null>(null);
  const [editValue, setEditValue] = useState(1);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jsonFetch<{
        supplements: Supplement[];
        logs: Pick<SupplementLog, "id" | "supplement_id">[];
      }>("/api/supplements");
      setItems(data.supplements);
      setLogs(data.logs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function countForSupplement(supplementId: string) {
    return logs.filter((l) => l.supplement_id === supplementId).length;
  }

  async function addItem() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await jsonFetch<{ supplement: Supplement }>("/api/supplements", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      toast.success("Supplement added");
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
      await jsonFetch(`/api/supplements/${id}`, { method: "DELETE" });
      toast.success("Removed");
      setItems((prev) => prev.filter((x) => x.id !== id));
      setLogs((prev) => prev.filter((l) => l.supplement_id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  async function logTake(supplementId: string) {
    const count = countForSupplement(supplementId);
    const target = items.find((s) => s.id === supplementId)?.daily_target ?? 1;
    if (count >= target) return;

    try {
      const data = await jsonFetch<{ log: Pick<SupplementLog, "id" | "supplement_id"> }>(
        `/api/supplements/${supplementId}/log`,
        { method: "POST" },
      );
      setLogs((prev) => [...prev, data.log]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log");
    }
  }

  async function undoTake(supplementId: string) {
    const count = countForSupplement(supplementId);
    if (count <= 0) return;

    try {
      const data = await jsonFetch<{ ok: boolean; removedId: string }>(
        `/api/supplements/${supplementId}/log`,
        { method: "DELETE" },
      );
      setLogs((prev) => prev.filter((l) => l.id !== data.removedId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to undo");
    }
  }

  async function saveTarget() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const data = await jsonFetch<{ supplement: Supplement }>(
        `/api/supplements/${editTarget.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ daily_target: editValue }),
        },
      );
      setItems((prev) =>
        prev.map((s) => (s.id === data.supplement.id ? data.supplement : s)),
      );
      toast.success("Daily target updated");
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setEditSaving(false);
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
              {items.length === 1 ? "supplement" : "supplements"} logged
            </>
          )}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button
            type="button"
            size="lg"
            className="min-h-11 touch-manipulation shadow-sm"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" />
            Add supplement
          </Button>
          <DialogContent className="border-border/80 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New supplement</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="sup-name">Name</Label>
              <Input
                id="sup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vitamin D3"
                className="h-11"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addItem();
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={saving || !name.trim()} onClick={() => void addItem()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit daily target dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-border/80 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit daily target</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            How many times per day should you take{" "}
            <span className="text-foreground font-medium">{editTarget?.name}</span>?
          </p>
          <div className="flex items-center justify-center gap-4 py-4">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full"
              disabled={editValue <= 1}
              onClick={() => setEditValue((v) => Math.max(1, v - 1))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="text-3xl font-bold tabular-nums">{editValue}</span>
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full"
              disabled={editValue >= 20}
              onClick={() => setEditValue((v) => Math.min(20, v + 1))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button disabled={editSaving} onClick={() => void saveTarget()}>
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border-muted-foreground/20 from-muted/40 flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-gradient-to-b to-transparent px-6 py-16 text-center">
          <div className="bg-background/90 text-muted-foreground flex size-14 items-center justify-center rounded-2xl border shadow-sm">
            <Pill className="size-7 opacity-60" />
          </div>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
            No supplements logged yet.
          </p>
          <Button size="lg" className="min-h-11" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add supplement
          </Button>
        </div>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => {
            const needsVisual = !s.image_url;
            const count = countForSupplement(s.id);
            const target = s.daily_target;
            const done = count >= target;

            return (
              <FadeItem key={s.id}>
                <LiftHover>
                  <Card
                    className={cn(
                      "group/card relative overflow-hidden rounded-2xl border py-0 shadow-sm ring-1 ring-black/[0.03] transition-shadow hover:shadow-lg dark:ring-white/[0.05]",
                      needsVisual && "border-l-4 border-l-violet-400/80",
                      done && "ring-2 ring-emerald-500/40",
                    )}
                  >
                    {/* Clickable image area to log a take */}
                    <button
                      type="button"
                      className="bg-muted relative aspect-[4/3] w-full overflow-hidden focus:outline-none"
                      onClick={() => void logTake(s.id)}
                      disabled={done}
                    >
                      {s.image_url ? (
                        <Image
                          src={s.image_url}
                          alt=""
                          fill
                          className={cn(
                            "object-cover transition-transform duration-500 group-hover/card:scale-[1.04]",
                            done && "brightness-75",
                          )}
                          sizes="(max-width:768px) 100vw, 33vw"
                          unoptimized={
                            s.image_url.includes("placehold.co") ||
                            s.image_url.startsWith("data:")
                          }
                        />
                      ) : (
                        <div className="from-muted flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br to-violet-200/30 p-6 text-center dark:to-violet-950/30">
                          <Pill className="text-muted-foreground size-8 opacity-40" />
                          <span className="text-muted-foreground text-xs font-medium">
                            No image yet
                          </span>
                        </div>
                      )}

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-90" />

                      {/* Green checkmark overlay when done */}
                      {done && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                            <Check className="size-9 text-white" strokeWidth={3} />
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h2 className="font-heading line-clamp-2 text-lg font-semibold leading-tight text-white drop-shadow-md">
                          {s.name}
                        </h2>
                      </div>

                      {/* Progress badge */}
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-md",
                            done
                              ? "border-emerald-400/40 bg-emerald-500/25 text-emerald-100"
                              : "border-white/25 bg-white/15 text-white",
                          )}
                        >
                          {count} / {target}
                        </span>
                      </div>
                    </button>

                    <CardFooter className="border-t border-border/60 bg-muted/30 p-3 flex items-center gap-2">
                      {!done && count > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-9 touch-manipulation"
                          onClick={() => void undoTake(s.id)}
                        >
                          <Minus className="size-3.5" />
                          Undo
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-9 touch-manipulation"
                        onClick={() => {
                          setEditTarget(s);
                          setEditValue(s.daily_target);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <div className="flex-1" />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="min-h-9 touch-manipulation"
                        onClick={() => void remove(s.id)}
                      >
                        <Trash2 className="size-3.5" />
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
