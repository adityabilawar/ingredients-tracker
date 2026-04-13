import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecipesLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <header className="overflow-hidden rounded-xl border border-border bg-card p-6 md:p-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-9 max-w-md rounded-lg" />
          <Skeleton className="h-4 max-w-2xl rounded-md" />
        </div>
      </header>

      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[min(26rem,calc(100vh-18rem))] flex-col items-center justify-center gap-6 rounded-xl border border-border bg-card px-6 py-16"
      >
        <div className="border-border relative flex size-[4.5rem] items-center justify-center rounded-xl border bg-muted">
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
            Preparing your recipe workspace…
          </p>
        </div>
        <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
