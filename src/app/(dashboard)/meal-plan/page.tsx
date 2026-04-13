import { MealPlanClient } from "./meal-plan-client";

export default function MealPlanPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <header className="max-w-2xl space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Meal plan
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Plan your weekly meals using saved recipes.
        </p>
      </header>
      <MealPlanClient />
    </div>
  );
}
