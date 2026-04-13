import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardOverview } from "@/components/dashboard-overview";

function startOfWeekMonday(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ count: ingCount }, { count: supCount }, { count: recipeCount }] =
    await Promise.all([
      supabase
        .from("ingredients")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("supplements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("recipes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  const mon = startOfWeekMonday(new Date());
  const sun = addDays(mon, 6);
  const { data: meals } = await supabase
    .from("meal_plan_entries")
    .select("id, date, meal_type, recipes(name, thumbnail_url)")
    .eq("user_id", user.id)
    .gte("date", fmt(mon))
    .lte("date", fmt(sun))
    .order("date", { ascending: true });

  type MealRow = {
    id: string;
    date: string;
    meal_type: string;
    recipes: { name?: string; thumbnail_url?: string | null } | null;
  };
  const upcoming = ((meals ?? []) as MealRow[]).slice(0, 5).map((m) => ({
    id: m.id,
    date: m.date,
    meal_type: m.meal_type,
    name: m.recipes?.name ?? "Recipe",
    thumb: m.recipes?.thumbnail_url ?? null,
  }));

  return (
    <DashboardOverview
      ingCount={ingCount ?? 0}
      supCount={supCount ?? 0}
      recipeCount={recipeCount ?? 0}
      mealSlotCount={meals?.length ?? 0}
      upcoming={upcoming}
    />
  );
}
