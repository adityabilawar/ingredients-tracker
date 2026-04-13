import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Recipe, RecipeIngredient } from "@/types/database";
import { RecipeVideos } from "./recipe-videos";
import { RecipeImageLoader } from "@/components/recipe-image-loader";

type PageProps = { params: Promise<{ id: string }> };

type RecipeWithLines = Recipe & {
  recipe_ingredients: RecipeIngredient[] | null;
};

export default async function RecipeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw, error } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !raw) notFound();
  const recipe = raw as RecipeWithLines;

  const ingredients = (recipe.recipe_ingredients ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

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
                alt=""
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
              <RecipeImageLoader
                key={recipe.id}
                recipeId={recipe.id}
                title={recipe.name}
                className="object-cover"
                sizes="(max-width:768px) 100vw, 50vw"
                priority
              />
            )}
          </div>
          <div className="flex flex-col justify-center space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-muted text-muted-foreground rounded-full border border-border px-3 py-1 text-xs font-medium capitalize">
                {recipe.source}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {recipe.name}
            </h1>
            <div>
              <h2 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                Ingredients
              </h2>
              {ingredients.length === 0 ? (
                <p className="text-muted-foreground text-sm">No ingredients listed.</p>
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
      </header>

      <section className="space-y-4">
        <RecipeVideos recipeId={recipe.id} />
      </section>
    </div>
  );
}
