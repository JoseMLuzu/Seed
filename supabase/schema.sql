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

create table if not exists public.seed_planet_members (
  planet_id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_email text not null,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  invited_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at timestamptz not null default now(),
  primary key (planet_id, member_email)
);

alter table public.seed_planets enable row level security;
alter table public.seed_notes enable row level security;
alter table public.seed_planet_members enable row level security;

drop policy if exists "Users can read planet memberships" on public.seed_planet_members;
drop policy if exists "Owners can manage planet memberships" on public.seed_planet_members;
drop policy if exists "Owners can update planet memberships" on public.seed_planet_members;
drop policy if exists "Owners can delete planet memberships" on public.seed_planet_members;

create policy "Users can read planet memberships"
  on public.seed_planet_members for select
  using (
    auth.uid() = owner_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(member_email)
  );

create policy "Owners can manage planet memberships"
  on public.seed_planet_members for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.seed_planets p
      where p.id = seed_planet_members.planet_id
        and p.user_id = auth.uid()
    )
  );

create policy "Owners can update planet memberships"
  on public.seed_planet_members for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can delete planet memberships"
  on public.seed_planet_members for delete
  using (auth.uid() = owner_id);

drop policy if exists "Users can read own seed planets" on public.seed_planets;
drop policy if exists "Users can insert own seed planets" on public.seed_planets;
drop policy if exists "Users can update own seed planets" on public.seed_planets;
drop policy if exists "Users can delete own seed planets" on public.seed_planets;

create policy "Users can read own seed planets"
  on public.seed_planets for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.seed_planet_members m
      where m.planet_id = seed_planets.id
        and lower(m.member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "Users can insert own seed planets"
  on public.seed_planets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own seed planets"
  on public.seed_planets for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.seed_planet_members m
      where m.planet_id = seed_planets.id
        and lower(m.member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and m.role in ('owner', 'editor')
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.seed_planet_members m
      where m.planet_id = seed_planets.id
        and lower(m.member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and m.role in ('owner', 'editor')
    )
  );

create policy "Users can delete own seed planets"
  on public.seed_planets for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own seed notes" on public.seed_notes;
drop policy if exists "Users can insert own seed notes" on public.seed_notes;
drop policy if exists "Users can update own seed notes" on public.seed_notes;
drop policy if exists "Users can delete own seed notes" on public.seed_notes;

create policy "Users can read own seed notes"
  on public.seed_notes for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.seed_planet_members m
      where m.planet_id = seed_notes.planet_id
        and lower(m.member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "Users can insert own seed notes"
  on public.seed_notes for insert
  with check (
    auth.uid() = user_id
    and (
      exists (
        select 1 from public.seed_planets p
        where p.id = seed_notes.planet_id
          and p.user_id = auth.uid()
      )
      or exists (
        select 1 from public.seed_planet_members m
        where m.planet_id = seed_notes.planet_id
          and lower(m.member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          and m.role in ('owner', 'editor')
      )
    )
  );

create policy "Users can update own seed notes"
  on public.seed_notes for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.seed_planet_members m
      where m.planet_id = seed_notes.planet_id
        and lower(m.member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and m.role in ('owner', 'editor')
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.seed_planet_members m
      where m.planet_id = seed_notes.planet_id
        and lower(m.member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and m.role in ('owner', 'editor')
    )
  );

create policy "Users can delete own seed notes"
  on public.seed_notes for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.seed_planet_members m
      where m.planet_id = seed_notes.planet_id
        and lower(m.member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and m.role in ('owner', 'editor')
    )
  );

alter table public.seed_planets replica identity full;
alter table public.seed_notes replica identity full;
alter table public.seed_planet_members replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seed_planets'
  ) then
    alter publication supabase_realtime add table public.seed_planets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seed_notes'
  ) then
    alter publication supabase_realtime add table public.seed_notes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seed_planet_members'
  ) then
    alter publication supabase_realtime add table public.seed_planet_members;
  end if;
end $$;
