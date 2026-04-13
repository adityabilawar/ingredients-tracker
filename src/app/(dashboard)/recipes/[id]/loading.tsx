import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecipeDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <Skeleton className="h-9 w-36 rounded-xl" />
      <div
        role="status"
        aria-live="polite"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="grid gap-6 p-6 md:grid-cols-2 md:gap-8 md:p-8">
          <Skeleton className="aspect-[16/10] w-full rounded-lg" />
          <div className="flex flex-col justify-center space-y-4">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-10 w-full max-w-md rounded-lg" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-[85%] rounded-md" />
            </div>
          </div>
        </div>
        <div className="border-t border-border px-6 py-10 md:px-8">
          <div className="flex min-h-[8rem] flex-col items-center justify-center gap-4">
            <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
            <p className="text-muted-foreground text-sm font-medium">
              Loading recipe…
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
