"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChefHat, Pill, Salad, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stagger, FadeItem } from "@/components/motion-primitives";

const ease = [0.22, 1, 0.36, 1] as const;

type MealPreview = {
  id: string;
  date: string;
  meal_type: string;
  name: string;
  thumb: string | null;
};

export function DashboardOverview({
  ingCount,
  supCount,
  recipeCount,
  mealSlotCount,
  upcoming,
}: {
  ingCount: number;
  supCount: number;
  recipeCount: number;
  mealSlotCount: number;
  upcoming: MealPreview[];
}) {
  const stats = [
    {
      label: "My pantry",
      value: ingCount,
      hint: "Ingredients on hand",
      icon: Salad,
      href: "/ingredients",
      accent: "from-emerald-600/15 to-herb/10",
    },
    {
      label: "Supplements",
      value: supCount,
      hint: "Logged items",
      icon: Pill,
      href: "/supplements",
      accent: "from-violet-600/10 to-herb/10",
    },
    {
      label: "Recipes",
      value: recipeCount,
      hint: "Saved ideas",
      icon: ChefHat,
      href: "/recipes",
      accent: "from-terracotta/15 to-amber-500/10",
    },
    {
      label: "Meal plan",
      value: mealSlotCount,
      hint: "Slots this week",
      icon: UtensilsCrossed,
      href: "/meal-plan",
      accent: "from-sky-600/10 to-herb/10",
    },
  ] as const;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 md:gap-14">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06] md:rounded-3xl">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80"
            alt=""
            fill
            className="object-cover opacity-35 dark:opacity-25"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/92 to-background/55 dark:from-background dark:via-background/95 dark:to-background/70" />
          <div className="from-herb/8 absolute inset-0 bg-gradient-to-tl to-transparent" />
        </div>
        <div className="relative grid gap-8 p-6 md:grid-cols-[1.1fr_0.9fr] md:items-center md:p-10 lg:p-12">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
          >
            <p className="text-terracotta mb-2 text-xs font-semibold uppercase tracking-[0.2em]">
              Today in your kitchen
            </p>
            <h1 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-foreground md:text-4xl lg:text-[2.65rem]">
              Cook with clarity.{" "}
              <span className="text-gradient-herb">Track less, taste more.</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-lg text-pretty text-sm leading-relaxed md:text-base">
              A calm home for pantry staples, saved recipes, and the week ahead —
              designed around how you actually cook.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/ingredients" className={cn(buttonVariants({ size: "lg" }))}>
                Stock pantry
              </Link>
              <Link
                href="/recipes"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Find recipes
              </Link>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, ease, delay: 0.08 }}
            className="relative hidden aspect-[4/3] overflow-hidden rounded-2xl border border-white/50 shadow-lg md:block dark:border-white/10"
          >
            <Image
              src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80"
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 768px) 40vw, 0px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <p className="absolute bottom-4 left-4 right-4 font-heading text-lg font-medium text-white drop-shadow-sm">
              Fresh picks, warm plates
            </p>
          </motion.div>
        </div>
      </section>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <FadeItem key={s.label}>
            <Link href={s.href} className="group block h-full min-h-[44px]">
              <Card
                className={cn(
                  "h-full border-border/80 bg-card/90 py-0 shadow-sm ring-1 ring-black/[0.03] transition-all duration-300",
                  "hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md dark:ring-white/[0.05]",
                )}
              >
                <CardContent className="relative overflow-hidden p-5">
                  <div
                    className={cn(
                      "pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-gradient-to-br opacity-90 blur-2xl transition-opacity group-hover:opacity-100",
                      s.accent,
                    )}
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        {s.label}
                      </p>
                      <p className="font-heading mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                        {s.value}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">{s.hint}</p>
                    </div>
                    <div className="bg-herb-muted text-herb flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/10 shadow-inner">
                      <s.icon className="size-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </FadeItem>
        ))}
      </Stagger>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4 px-0.5">
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Quick actions
              </h2>
              <p className="text-muted-foreground text-sm">
                Jump between pantry, recipes, and planning
              </p>
            </div>
          </div>
          <Card className="border-border/80 bg-card/95 py-6 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/ingredients" className={cn(buttonVariants({ size: "lg" }))}>
                Add ingredient
              </Link>
              <Link
                href="/supplements"
                className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
              >
                Log supplement
              </Link>
              <Link
                href="/recipes"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Browse recipes
              </Link>
              <Link
                href="/meal-plan"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Meal plan
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="px-0.5">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Meal plan
            </h2>
            <p className="text-muted-foreground text-sm">
              This week at a glance (Mon–Sun)
            </p>
          </div>
          <Card className="border-border/80 bg-card/95 py-6 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Nothing scheduled yet.{" "}
                  <Link href="/meal-plan" className="text-primary font-medium underline-offset-4 hover:underline">
                    Open meal plan
                  </Link>{" "}
                  and line up something delicious.
                </p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((m, i) => (
                    <motion.li
                      key={m.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.35, ease }}
                      className="flex items-center gap-3 rounded-xl border border-transparent px-1 py-2 transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-lg border border-border/60">
                        {m.thumb ? (
                          <Image
                            src={m.thumb}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                            unoptimized={
                              m.thumb.includes("placehold.co") ||
                              m.thumb.startsWith("data:")
                            }
                          />
                        ) : (
                          <div className="text-muted-foreground flex h-full items-center justify-center">
                            <UtensilsCrossed className="size-4 opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium leading-tight">{m.name}</p>
                        <p className="text-muted-foreground text-xs capitalize">
                          {m.date} · {m.meal_type}
                        </p>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
