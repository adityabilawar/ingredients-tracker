import { SupplementsClient } from "./supplements-client";

export default function SupplementsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm ring-1 ring-black/[0.03] md:rounded-3xl md:p-8 dark:ring-white/[0.05]">
        <div className="from-violet-500/8 pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-gradient-to-bl to-herb/10 blur-3xl" />
        <div className="relative max-w-2xl space-y-3">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.2em]">
            Supplements
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Vitamins & daily support
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
            Log what you take alongside pantry ingredients — same beautiful cards
            and quick add flow.
          </p>
        </div>
      </header>
      <SupplementsClient />
    </div>
  );
}
