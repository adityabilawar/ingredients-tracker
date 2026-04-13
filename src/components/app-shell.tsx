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
import { ThemeToggle } from "@/components/theme-toggle";
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
    <nav className="flex flex-col gap-0.5 p-3">
      <p className="text-muted-foreground px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-widest">
        Menu
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
              "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
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
      <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r border-sidebar-border md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
          <span className="text-[15px] font-semibold tracking-tight">
            PantryOS
          </span>
        </div>
        <NavLinks />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border px-3 backdrop-blur-xl md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-9 shrink-0 md:hidden",
              )}
            >
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 border-sidebar-border bg-sidebar p-0">
              <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
                <span className="text-[15px] font-semibold">PantryOS</span>
              </div>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex flex-1 items-center justify-end gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "default" }),
                  "h-9 gap-2 rounded-full px-2 hover:bg-accent",
                )}
              >
                <Avatar className="size-7">
                  <AvatarImage src={meta?.avatar_url} alt="" />
                  <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[140px] truncate text-[13px] font-medium sm:inline">
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
