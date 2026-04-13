import { SupplementsClient } from "./supplements-client";

export default function SupplementsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <header className="max-w-2xl space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Supplements
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Track your vitamins and daily supplements.
        </p>
      </header>
      <SupplementsClient />
    </div>
  );
}
