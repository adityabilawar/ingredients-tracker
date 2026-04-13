-- Ingredients Tracker: core schema, RLS, and storage

-- Tables
create table if not exists public.ingredients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  name text not null,
  image_url text,
  created_at timestamptz default now() not null
);

create table if not exists public.supplements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  name text not null,
  image_url text,
  created_at timestamptz default now() not null
);

create table if not exists public.recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  name text not null,
  spoonacular_id integer,
  youtube_video_id text,
  youtube_url text,
  thumbnail_url text,
  source text not null default 'custom' check (source in ('suggested', 'searched', 'custom')),
  created_at timestamptz default now() not null
);

create index if not exists recipes_user_id_idx on public.recipes (user_id);
create index if not exists ingredients_user_id_idx on public.ingredients (user_id);
create index if not exists supplements_user_id_idx on public.supplements (user_id);

create table if not exists public.recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes (id) on delete cascade not null,
  name text not null,
  sort_order integer not null default 0
);

create index if not exists recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);

create table if not exists public.meal_plan_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  recipe_id uuid references public.recipes (id) on delete cascade not null,
  date date not null,
  meal_type text not null check (
    meal_type in ('breakfast', 'lunch', 'dinner', 'snack')
  ),
  created_at timestamptz default now() not null,
  unique (user_id, date, meal_type)
);

create index if not exists meal_plan_entries_user_date_idx on public.meal_plan_entries (user_id, date);

-- RLS
alter table public.ingredients enable row level security;
alter table public.supplements enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plan_entries enable row level security;

create policy "ingredients_select_own" on public.ingredients for select using (auth.uid() = user_id);
create policy "ingredients_insert_own" on public.ingredients for insert with check (auth.uid() = user_id);
create policy "ingredients_update_own" on public.ingredients for update using (auth.uid() = user_id);
create policy "ingredients_delete_own" on public.ingredients for delete using (auth.uid() = user_id);

create policy "supplements_select_own" on public.supplements for select using (auth.uid() = user_id);
create policy "supplements_insert_own" on public.supplements for insert with check (auth.uid() = user_id);
create policy "supplements_update_own" on public.supplements for update using (auth.uid() = user_id);
create policy "supplements_delete_own" on public.supplements for delete using (auth.uid() = user_id);

create policy "recipes_select_own" on public.recipes for select using (auth.uid() = user_id);
create policy "recipes_insert_own" on public.recipes for insert with check (auth.uid() = user_id);
create policy "recipes_update_own" on public.recipes for update using (auth.uid() = user_id);
create policy "recipes_delete_own" on public.recipes for delete using (auth.uid() = user_id);

create policy "recipe_ingredients_select" on public.recipe_ingredients for select using (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);
create policy "recipe_ingredients_insert" on public.recipe_ingredients for insert with check (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);
create policy "recipe_ingredients_update" on public.recipe_ingredients for update using (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);
create policy "recipe_ingredients_delete" on public.recipe_ingredients for delete using (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);

create policy "meal_plan_select_own" on public.meal_plan_entries for select using (auth.uid() = user_id);
create policy "meal_plan_insert_own" on public.meal_plan_entries for insert with check (auth.uid() = user_id);
create policy "meal_plan_update_own" on public.meal_plan_entries for update using (auth.uid() = user_id);
create policy "meal_plan_delete_own" on public.meal_plan_entries for delete using (auth.uid() = user_id);

-- Storage bucket for AI / uploaded images
insert into storage.buckets (id, name, public)
values ('ingredient-images', 'ingredient-images', true)
on conflict (id) do nothing;

create policy "ingredient_images_public_read"
on storage.objects for select
using (bucket_id = 'ingredient-images');

create policy "ingredient_images_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'ingredient-images'
  and auth.role() = 'authenticated'
  and (storage.foldername (name))[1] = auth.uid()::text
);

create policy "ingredient_images_update_own"
on storage.objects for update
using (
  bucket_id = 'ingredient-images'
  and auth.role() = 'authenticated'
  and (storage.foldername (name))[1] = auth.uid()::text
);

create policy "ingredient_images_delete_own"
on storage.objects for delete
using (
  bucket_id = 'ingredient-images'
  and auth.role() = 'authenticated'
  and (storage.foldername (name))[1] = auth.uid()::text
);
