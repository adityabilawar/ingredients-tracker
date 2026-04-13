-- Add daily_target to supplements and create supplement_logs for daily tracking

alter table public.supplements
  add column if not exists daily_target integer not null default 1
  check (daily_target >= 1 and daily_target <= 20);

create table if not exists public.supplement_logs (
  id uuid default gen_random_uuid() primary key,
  supplement_id uuid references public.supplements (id) on delete cascade not null,
  user_id uuid references auth.users (id) on delete cascade not null,
  taken_date date not null default current_date,
  created_at timestamptz default now() not null
);

create index if not exists supplement_logs_user_date_idx
  on public.supplement_logs (user_id, taken_date);
create index if not exists supplement_logs_supplement_id_idx
  on public.supplement_logs (supplement_id);

alter table public.supplement_logs enable row level security;

create policy "supplement_logs_select_own"
  on public.supplement_logs for select using (auth.uid() = user_id);
create policy "supplement_logs_insert_own"
  on public.supplement_logs for insert with check (auth.uid() = user_id);
create policy "supplement_logs_delete_own"
  on public.supplement_logs for delete using (auth.uid() = user_id);
