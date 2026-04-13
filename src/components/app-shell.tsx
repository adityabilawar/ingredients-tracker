"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChefHat,
  LayoutDashboard,
  Menu,
  Pill,
  Salad,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const nav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/ingredients", label: "Pantry", icon: Salad },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/meal-plan", label: "Meal plan", icon: UtensilsCrossed },
  { href: "/supplements", label: "Supplements", icon: Pill },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      <p className="text-muted-foreground px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
        Navigate
      </p>
      {nav.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
              active
                ? "text-primary bg-herb-muted/80 border border-primary/15 shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent/70 border border-transparent",
            )}
          >
            {active ? (
              <span className="bg-primary/8 pointer-events-none absolute inset-0 rounded-xl" />
            ) : null}
            <Icon
              className={cn(
                "relative z-10 size-[18px] shrink-0",
                active ? "text-primary" : "opacity-80",
              )}
            />
            <span className="relative z-10">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();
  const email = user.email ?? "";
  const initial = email ? email[0]!.toUpperCase() : "?";
  const meta = user.user_metadata as { avatar_url?: string; full_name?: string };
  const display =
    (typeof meta?.full_name === "string" && meta.full_name) || email || "Account";

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-svh w-full">
      <aside className="bg-sidebar/95 text-sidebar-foreground relative hidden w-[17rem] shrink-0 flex-col border-r border-sidebar-border/80 shadow-[inset_-1px_0_0_rgba(0,0,0,0.02)] backdrop-blur-md md:flex dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
        <div className="from-herb/12 absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent" />
        <div className="relative flex h-[4.25rem] items-center gap-3 border-b border-sidebar-border/70 px-5">
          <div className="bg-primary/12 text-primary flex size-10 items-center justify-center rounded-xl border border-primary/15 shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="font-heading text-lg font-semibold tracking-tight">
              Pantry
            </span>
            <p className="text-muted-foreground truncate text-xs">Ingredients & meals</p>
          </div>
        </div>
        <NavLinks />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/75 supports-[backdrop-filter]:bg-background/55 sticky top-0 z-40 flex min-h-14 items-center gap-2 border-b border-border/60 px-3 py-2 backdrop-blur-xl md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-11 shrink-0 md:hidden",
              )}
            >
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,20rem)] border-sidebar-border/80 bg-sidebar/98 p-0">
              <div className="flex h-14 items-center gap-3 border-b border-sidebar-border/80 px-4">
                <div className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-lg border border-primary/15">
                  <Sparkles className="size-4" />
                </div>
                <span className="font-heading font-semibold">Pantry</span>
              </div>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex flex-1 items-center justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "default" }),
                  "h-11 min-h-11 gap-2 rounded-full border border-transparent px-2 hover:border-border hover:bg-muted/60",
                )}
              >
                <Avatar className="size-9 ring-2 ring-background">
                  <AvatarImage src={meta?.avatar_url} alt="" />
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[160px] truncate text-sm font-medium sm:inline">
                  {display}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{display}</p>
                    {email ? (
                      <p className="text-muted-foreground text-xs leading-none">
                        {email}
                      </p>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10 lg:px-10 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
