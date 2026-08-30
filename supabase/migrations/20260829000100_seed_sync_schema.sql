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

create index if not exists seed_planets_user_created_idx
  on public.seed_planets (user_id, created_at_ms);

create index if not exists seed_notes_user_planet_idx
  on public.seed_notes (user_id, planet_id);

alter table public.seed_planets enable row level security;
alter table public.seed_notes enable row level security;

drop policy if exists "Users can read own seed planets" on public.seed_planets;
drop policy if exists "Users can insert own seed planets" on public.seed_planets;
drop policy if exists "Users can update own seed planets" on public.seed_planets;
drop policy if exists "Users can delete own seed planets" on public.seed_planets;

create policy "Users can read own seed planets"
  on public.seed_planets for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own seed planets"
  on public.seed_planets for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own seed planets"
  on public.seed_planets for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own seed planets"
  on public.seed_planets for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own seed notes" on public.seed_notes;
drop policy if exists "Users can insert own seed notes" on public.seed_notes;
drop policy if exists "Users can update own seed notes" on public.seed_notes;
drop policy if exists "Users can delete own seed notes" on public.seed_notes;

create policy "Users can read own seed notes"
  on public.seed_notes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own seed notes"
  on public.seed_notes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own seed notes"
  on public.seed_notes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own seed notes"
  on public.seed_notes for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.seed_planets from anon;
revoke all on table public.seed_notes from anon;
grant select, insert, update, delete on table public.seed_planets to authenticated;
grant select, insert, update, delete on table public.seed_notes to authenticated;

alter table public.seed_planets replica identity full;
alter table public.seed_notes replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seed_planets'
  ) then
    alter publication supabase_realtime add table public.seed_planets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seed_notes'
  ) then
    alter publication supabase_realtime add table public.seed_notes;
  end if;
end
$$;
