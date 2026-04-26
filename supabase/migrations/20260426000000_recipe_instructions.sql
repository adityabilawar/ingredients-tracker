-- Real recipe overhaul: store Spoonacular instructions and metadata so the
-- detail page can render numbered steps, ready time, servings, and a link
-- back to the source. `instructions` is `[{ "number": 1, "step": "..." }, ...]`
-- matching `analyzedInstructions[0].steps` from Spoonacular.

alter table public.recipes
  add column if not exists instructions jsonb,
  add column if not exists ready_in_minutes integer,
  add column if not exists servings integer,
  add column if not exists source_url text;

-- Per-recipe missing-from-pantry list captured when the recipe was saved.
-- Kept separate from `recipe_ingredients` so we can render "you'll need to
-- buy …" without losing the full ingredient line copy.
create table if not exists public.recipe_missing_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes (id) on delete cascade not null,
  name text not null,
  sort_order integer not null default 0
);

create index if not exists recipe_missing_ingredients_recipe_id_idx
  on public.recipe_missing_ingredients (recipe_id);

alter table public.recipe_missing_ingredients enable row level security;

create policy "recipe_missing_select" on public.recipe_missing_ingredients for select using (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);
create policy "recipe_missing_insert" on public.recipe_missing_ingredients for insert with check (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);
create policy "recipe_missing_update" on public.recipe_missing_ingredients for update using (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);
create policy "recipe_missing_delete" on public.recipe_missing_ingredients for delete using (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);
