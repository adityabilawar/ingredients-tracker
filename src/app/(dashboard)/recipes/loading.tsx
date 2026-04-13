import { Skeleton } from "@/components/ui/skeleton";

export default function RecipesLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
