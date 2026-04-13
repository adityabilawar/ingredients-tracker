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
      label: "Pantry",
      value: ingCount,
      hint: "Items on hand",
      icon: Salad,
      href: "/ingredients",
    },
    {
      label: "Supplements",
      value: supCount,
      hint: "Logged items",
      icon: Pill,
      href: "/supplements",
    },
    {
      label: "Recipes",
      value: recipeCount,
      hint: "Saved",
      icon: ChefHat,
      href: "/recipes",
    },
    {
      label: "Meal plan",
      value: mealSlotCount,
      hint: "Slots this week",
      icon: UtensilsCrossed,
      href: "/meal-plan",
    },
  ] as const;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 md:gap-14">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Home
        </h1>
      </header>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <FadeItem key={s.label}>
            <Link href={s.href} className="group block h-full min-h-[44px]">
              <Card
                className={cn(
                  "h-full border-border py-0 transition-all duration-200",
                  "hover:-translate-y-0.5 hover:shadow-md",
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        {s.label}
                      </p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                        {s.value}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">{s.hint}</p>
                    </div>
                    <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                      <s.icon className="size-[18px]" />
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
              <h2 className="text-lg font-semibold tracking-tight">
                Quick actions
              </h2>
            </div>
          </div>
          <Card className="border-border py-6">
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
                Recipes
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
            <h2 className="text-lg font-semibold tracking-tight">
              Meal plan
            </h2>
            <p className="text-muted-foreground text-sm">
              This week at a glance (Mon–Sun)
            </p>
          </div>
          <Card className="border-border py-6">
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
                      className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-accent"
                    >
                      <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-lg">
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
