import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingStatusProps = {
  title: string;
  subtitle: string;
  variant?: "centered" | "inline";
  className?: string;
  children?: ReactNode;
};

export function LoadingStatus({
  title,
  subtitle,
  variant = "inline",
  className,
  children,
}: LoadingStatusProps) {
  if (variant === "centered") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex min-h-[min(28rem,calc(100vh-14rem))] flex-col items-center justify-center gap-6 rounded-xl border border-border px-6 py-16",
          className,
        )}
      >
        <div className="flex size-16 items-center justify-center rounded-xl bg-muted">
          <Loader2 className="text-primary size-9 animate-spin" aria-hidden />
        </div>
        <div className="max-w-sm space-y-2 text-center">
          <p className="text-xl font-semibold tracking-tight">{title}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {subtitle}
          </p>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className={cn("space-y-4", className)}>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card/50 px-4 py-3 md:px-5 md:py-4">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg md:size-11">
          <Loader2
            className="text-primary size-5 animate-spin"
            aria-hidden
          />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold md:text-base">{title}</p>
          <p className="text-muted-foreground text-xs leading-relaxed md:text-sm">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
