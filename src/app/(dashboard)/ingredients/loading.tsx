import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

export default function IngredientsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <LoadingStatus
        title="Loading ingredients"
        subtitle="Fetching your pantry from the server…"
      >
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </LoadingStatus>
    </div>
  );
}
