import { RecipesClient } from "./recipes-client";

export default function RecipesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm ring-1 ring-black/[0.03] md:rounded-3xl md:p-8 dark:ring-white/[0.05]">
        <div className="from-terracotta/12 pointer-events-none absolute -left-24 -top-16 size-56 rounded-full bg-gradient-to-br to-herb/10 blur-3xl" />
        <div className="relative max-w-2xl space-y-3">
          <p className="text-terracotta text-xs font-semibold uppercase tracking-[0.2em]">
            Recipes
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Discover dishes worth saving
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
            Suggestions from Spoonacular (with an OpenAI fallback), search across
            the web catalog, and your saved library with YouTube embeds when you
            edit.
          </p>
        </div>
      </header>
      <RecipesClient />
    </div>
  );
}
