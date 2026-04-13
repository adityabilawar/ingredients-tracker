import Link from "next/link";
import { IngredientsClient } from "./ingredients-client";
import { ArrowUpRight } from "lucide-react";

export default function IngredientsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm ring-1 ring-black/[0.03] md:rounded-3xl md:p-8 dark:ring-white/[0.05]">
        <div className="from-herb/15 pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-gradient-to-br to-terracotta/10 blur-3xl" />
        <div className="relative max-w-2xl space-y-3">
          <p className="text-terracotta text-xs font-semibold uppercase tracking-[0.2em]">
            My pantry
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Ingredients you actually use
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
            Add what you have at home. Images use stock search first, then AI when
            needed — so your grid stays mouth-watering and easy to scan.
          </p>
          <Link
            href="/recipes"
            className="text-primary inline-flex items-center gap-1.5 pt-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Pull ideas from saved recipes
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </header>
      <IngredientsClient />
    </div>
  );
}
