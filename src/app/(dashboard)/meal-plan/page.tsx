import { MealPlanClient } from "./meal-plan-client";

export default function MealPlanPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm ring-1 ring-black/[0.03] md:rounded-3xl md:p-8 dark:ring-white/[0.05]">
        <div className="from-sky-500/10 pointer-events-none absolute -right-20 top-0 size-48 rounded-full bg-gradient-to-bl to-herb/10 blur-3xl" />
        <div className="relative max-w-2xl space-y-3">
          <p className="text-terracotta text-xs font-semibold uppercase tracking-[0.2em]">
            Meal plan
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Your week, plated with intention
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
            Plan breakfast, lunch, dinner, and snacks using your saved recipes —
            with thumbnails so the grid feels as good as opening the fridge.
          </p>
        </div>
      </header>
      <MealPlanClient />
    </div>
  );
}
