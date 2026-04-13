"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function useClientOrigin() {
  return useSyncExternalStore(
    () => () => {},
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    () => "",
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const origin = useClientOrigin();
  const [loading, setLoading] = useState<string | null>(null);

  const next = searchParams.get("next") || "/";
  const error = searchParams.get("error");

  async function signIn(provider: "google" | "github" | "apple") {
    if (!origin) return;
    setLoading(provider);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (err) {
      setLoading(null);
      toast.error(err.message);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden p-6">
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1498837167922-cddd25eae35a?auto=format&fit=crop&w=1920&q=80"
          alt=""
          fill
          className="object-cover opacity-40 dark:opacity-25"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/88 to-background/75 dark:from-background/95 dark:via-background/92 dark:to-background/85" />
        <div className="from-herb/20 absolute inset-0 bg-gradient-to-tl to-terracotta/10" />
      </div>
      <Card className="glass-panel relative w-full max-w-md rounded-2xl border-border/80 shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="font-heading text-2xl md:text-3xl">Welcome back</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Sign in to sync ingredients, recipes, and your meal plan across devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-2">
          {error ? (
            <p className="text-destructive text-sm">
              Authentication failed. Please try again.
            </p>
          ) : null}
          <Button
            size="lg"
            className="min-h-12 rounded-xl text-base shadow-sm"
            disabled={!origin || loading !== null}
            onClick={() => void signIn("google")}
          >
            {loading === "google" ? "Redirecting…" : "Continue with Google"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="min-h-12 rounded-xl text-base"
            disabled={!origin || loading !== null}
            onClick={() => void signIn("github")}
          >
            {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="min-h-12 rounded-xl text-base"
            disabled={!origin || loading !== null}
            onClick={() => void signIn("apple")}
          >
            {loading === "apple" ? "Redirecting…" : "Continue with Apple"}
          </Button>
          <p className="text-muted-foreground pt-1 text-center text-xs leading-relaxed">
            Configure Google, GitHub, and Apple in the Supabase Auth providers
            dashboard before using in production.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
