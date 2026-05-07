-- Seed Supabase schema
-- Run this in Supabase SQL Editor.

create table if not exists public.seed_planets (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  theme text not null default 'earth',
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table if not exists public.seed_notes (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  planet_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

alter table public.seed_planets enable row level security;
alter table public.seed_notes enable row level security;

drop policy if exists "Users can read own seed planets" on public.seed_planets;
drop policy if exists "Users can insert own seed planets" on public.seed_planets;
drop policy if exists "Users can update own seed planets" on public.seed_planets;
drop policy if exists "Users can delete own seed planets" on public.seed_planets;

create policy "Users can read own seed planets"
  on public.seed_planets for select
  using (auth.uid() = user_id);

create policy "Users can insert own seed planets"
  on public.seed_planets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own seed planets"
  on public.seed_planets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own seed planets"
  on public.seed_planets for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own seed notes" on public.seed_notes;
drop policy if exists "Users can insert own seed notes" on public.seed_notes;
drop policy if exists "Users can update own seed notes" on public.seed_notes;
drop policy if exists "Users can delete own seed notes" on public.seed_notes;

create policy "Users can read own seed notes"
  on public.seed_notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own seed notes"
  on public.seed_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own seed notes"
  on public.seed_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own seed notes"
  on public.seed_notes for delete
  using (auth.uid() = user_id);
