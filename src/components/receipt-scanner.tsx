"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Upload, Receipt, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step = "capture" | "scanning" | "review";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemsAdded: () => void;
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok)
    throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ReceiptScanner({ open, onOpenChange, onItemsAdded }: Props) {
  const [step, setStep] = useState<Step>("capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("capture");
    setPreview(null);
    setItems([]);
    setSelected(new Set());
    setAdding(false);
    setWarning(null);
  }, []);

  function handleClose(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  async function processImage(dataUrl: string) {
    setPreview(dataUrl);
    setStep("scanning");
    setWarning(null);

    try {
      const result = await jsonFetch<{
        items: string[];
        warning?: string;
      }>("/api/receipt-scan", {
        method: "POST",
        body: JSON.stringify({ image: dataUrl }),
      });

      if (result.items.length === 0) {
        toast.error(result.warning ?? "No food items found on this receipt");
        setStep("capture");
        setPreview(null);
        return;
      }

      if (result.warning) setWarning(result.warning);
      setItems(result.items);
      setSelected(new Set(result.items.map((_, i) => i)));
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to scan receipt");
      setStep("capture");
      setPreview(null);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    void processImage(dataUrl);
  }

  function toggleItem(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((_, i) => i)));
    }
  }

  async function addSelected() {
    const toAdd = items.filter((_, i) => selected.has(i));
    if (toAdd.length === 0) return;

    setAdding(true);
    let added = 0;
    const errors: string[] = [];

    for (const name of toAdd) {
      try {
        await jsonFetch("/api/ingredients", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        added++;
      } catch (e) {
        errors.push(
          `${name}: ${e instanceof Error ? e.message : "failed"}`,
        );
      }
    }

    setAdding(false);

    if (added > 0) {
      toast.success(`Added ${added} ingredient${added !== 1 ? "s" : ""}`);
      onItemsAdded();
    }
    if (errors.length > 0) {
      toast.error(`Failed to add: ${errors.join(", ")}`);
    }

    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            {step === "capture" && "Scan Receipt"}
            {step === "scanning" && "Scanning…"}
            {step === "review" && "Review Items"}
          </DialogTitle>
        </DialogHeader>

        {step === "capture" && (
          <div className="space-y-4 py-2">
            <p className="text-muted-foreground text-sm">
              Take a photo of your grocery receipt or upload an image to
              automatically extract ingredients.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="border-border hover:border-primary/50 hover:bg-muted flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors"
              >
                <Camera className="text-muted-foreground size-8" />
                <span className="text-sm font-medium">Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="border-border hover:border-primary/50 hover:bg-muted flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors"
              >
                <Upload className="text-muted-foreground size-8" />
                <span className="text-sm font-medium">Upload Image</span>
              </button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        {step === "scanning" && (
          <div className="flex flex-col items-center gap-4 py-8">
            {preview && (
              <img
                src={preview}
                alt="Receipt preview"
                className="max-h-40 rounded-lg object-contain opacity-60"
              />
            )}
            <Loader2 className="text-primary size-8 animate-spin" />
            <p className="text-muted-foreground text-sm">
              Reading your receipt with AI…
            </p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3 py-2">
            {warning && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {warning}
              </p>
            )}
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                {items.length} item{items.length !== 1 ? "s" : ""} found —
                uncheck any you don&apos;t want.
              </p>
              <Button
                variant="ghost"
                size="xs"
                onClick={toggleAll}
              >
                {selected.size === items.length ? "Deselect all" : "Select all"}
              </Button>
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {items.map((item, i) => (
                <li key={i}>
                  <label className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors">
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        selected.has(i)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {selected.has(i) && <Check className="size-3.5" />}
                    </span>
                    <span className="text-sm">{item}</span>
                  </label>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected.has(i)}
                    onChange={() => toggleItem(i)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {step === "capture" && (
            <Button variant="secondary" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          )}
          {step === "review" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("capture");
                  setPreview(null);
                  setItems([]);
                  setSelected(new Set());
                }}
              >
                <X className="size-4" />
                Rescan
              </Button>
              <Button
                disabled={adding || selected.size === 0}
                onClick={() => void addSelected()}
              >
                {adding ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  `Add ${selected.size} item${selected.size !== 1 ? "s" : ""}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
