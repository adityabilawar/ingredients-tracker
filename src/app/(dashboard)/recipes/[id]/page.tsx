import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  ShoppingCart,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { backfillRecipeFromSpoonacular } from "@/lib/recipe-backfill";
import type {
  Recipe,
  RecipeIngredient,
  RecipeMissingIngredient,
  RecipeStep,
} from "@/types/database";
import { RecipeVideos } from "./recipe-videos";

type PageProps = { params: Promise<{ id: string }> };

type RecipeWithLines = Recipe & {
  recipe_ingredients: RecipeIngredient[] | null;
  recipe_missing_ingredients: RecipeMissingIngredient[] | null;
};

function isRecipeStepArray(v: unknown): v is RecipeStep[] {
  return (
    Array.isArray(v) &&
    v.every(
      (s) =>
        s !== null &&
        typeof s === "object" &&
        typeof (s as { step?: unknown }).step === "string",
    )
  );
}

export default async function RecipeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /**
   * On-demand backfill for legacy AI-era recipes: pulls real instructions, a
   * real photo and metadata from Spoonacular the first time someone clicks
   * an old recipe. No-op when the recipe already has instructions.
   */
  const { data: pre } = await supabase
    .from("recipes")
    .select("id, name, spoonacular_id, thumbnail_url, instructions")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (pre) {
    await backfillRecipeFromSpoonacular(pre, supabase);
  }

  const { data: raw, error } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*), recipe_missing_ingredients(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !raw) notFound();
  const recipe = raw as RecipeWithLines;

  const ingredients = (recipe.recipe_ingredients ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const missing = (recipe.recipe_missing_ingredients ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const steps: RecipeStep[] = isRecipeStepArray(recipe.instructions)
    ? recipe.instructions
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/recipes"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex rounded-xl",
          )}
        >
          <ArrowLeft className="size-4" />
          Back to recipes
        </Link>
      </div>

      <header className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-8 md:p-8">
          <div className="bg-muted relative aspect-[16/10] w-full overflow-hidden rounded-lg">
            {recipe.thumbnail_url ? (
              <Image
                src={recipe.thumbnail_url}
                alt={recipe.name}
                fill
                className="object-cover"
                sizes="(max-width:768px) 100vw, 50vw"
                priority
                unoptimized={
                  recipe.thumbnail_url.includes("placehold.co") ||
                  recipe.thumbnail_url.startsWith("data:")
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <UtensilsCrossed className="text-muted-foreground size-16 opacity-40" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-muted text-muted-foreground rounded-full border border-border px-3 py-1 text-xs font-medium capitalize">
                {recipe.source}
              </span>
              {recipe.ready_in_minutes ? (
                <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium">
                  <Clock className="size-3.5" />
                  {recipe.ready_in_minutes} min
                </span>
              ) : null}
              {recipe.servings ? (
                <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium">
                  <Users className="size-3.5" />
                  {recipe.servings} servings
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {recipe.name}
            </h1>
            {recipe.source_url ? (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs font-medium underline-offset-4 hover:underline"
              >
                <ExternalLink className="size-3.5" />
                Original source
              </a>
            ) : null}
            <div>
              <h2 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                Ingredients
              </h2>
              {ingredients.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No ingredients listed.
                </p>
              ) : (
                <ul className="text-foreground/90 list-inside list-disc space-y-1.5 text-sm leading-relaxed md:text-base">
                  {ingredients.map((line) => (
                    <li key={line.id}>{line.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {missing.length > 0 ? (
          <div className="border-t border-border bg-amber-50/50 p-6 dark:bg-amber-950/15 md:p-8">
            <div className="flex items-start gap-3">
              <ShoppingCart className="text-amber-700 mt-0.5 size-5 shrink-0 dark:text-amber-300" />
              <div className="space-y-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Extra ingredients you&apos;ll need
                </h2>
                <ul className="text-foreground/85 grid gap-1 text-sm leading-relaxed sm:grid-cols-2 md:grid-cols-3">
                  {missing.map((m) => (
                    <li
                      key={m.id}
                      className="before:bg-amber-500/70 dark:before:bg-amber-300/70 flex items-center gap-2 before:size-1.5 before:shrink-0 before:rounded-full"
                    >
                      {m.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
            Instructions
          </h2>
        </div>
        {steps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Step-by-step instructions are not available for this recipe yet.
              {recipe.source_url ? (
                <>
                  {" "}
                  See the{" "}
                  <a
                    href={recipe.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    original recipe
                  </a>{" "}
                  for full details.
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {steps.map((s) => (
              <li
                key={`${s.number}-${s.step.slice(0, 20)}`}
                className="flex gap-4 rounded-xl border border-border bg-card p-4 md:p-5"
              >
                <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {s.number}
                </div>
                <p className="text-foreground/90 pt-1 text-sm leading-relaxed md:text-base">
                  {s.step}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
              Tutorial videos
            </h2>
            <p className="text-muted-foreground text-sm">
              Optional: watch someone make a version of this dish.
            </p>
          </div>
        </div>
        <RecipeVideos recipeId={recipe.id} />
      </section>
    </div>
  );
}
