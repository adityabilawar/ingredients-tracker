"use client";

import { useState, useSyncExternalStore } from "react";
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
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
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
            className="min-h-11 text-sm"
            disabled={!origin || loading !== null}
            onClick={() => void signIn("google")}
          >
            {loading === "google" ? "Redirecting…" : "Continue with Google"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="min-h-11 text-sm"
            disabled={!origin || loading !== null}
            onClick={() => void signIn("github")}
          >
            {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="min-h-11 text-sm"
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
