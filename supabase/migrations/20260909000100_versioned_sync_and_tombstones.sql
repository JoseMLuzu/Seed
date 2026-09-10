alter table public.seed_planets
  add column if not exists server_revision bigint not null default 0;

alter table public.seed_notes
  add column if not exists server_revision bigint not null default 0;

create index if not exists seed_planets_user_revision_idx
  on public.seed_planets (user_id, server_revision);

create index if not exists seed_notes_user_revision_idx
  on public.seed_notes (user_id, server_revision);

create table if not exists public.seed_sync_counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0
);

create table if not exists public.seed_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('note', 'planet')),
  entity_id text not null,
  server_revision bigint not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

create index if not exists seed_tombstones_user_revision_idx
  on public.seed_tombstones (user_id, server_revision);

create table if not exists public.seed_sync_conflicts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('note', 'planet')),
  entity_id text not null,
  base_revision bigint,
  displaced_revision bigint not null,
  displaced_value jsonb,
  incoming_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists seed_sync_conflicts_user_created_idx
  on public.seed_sync_conflicts (user_id, created_at desc);

create table if not exists public.seed_applied_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, mutation_id)
);

alter table public.seed_sync_counters enable row level security;
alter table public.seed_tombstones enable row level security;
alter table public.seed_sync_conflicts enable row level security;
alter table public.seed_applied_mutations enable row level security;

drop policy if exists "Users can read own seed tombstones" on public.seed_tombstones;
create policy "Users can read own seed tombstones"
  on public.seed_tombstones for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own seed conflicts" on public.seed_sync_conflicts;
create policy "Users can read own seed conflicts"
  on public.seed_sync_conflicts for select to authenticated
  using (auth.uid() = user_id);

revoke all on table public.seed_sync_counters from anon, authenticated;
revoke all on table public.seed_applied_mutations from anon, authenticated;
revoke all on table public.seed_tombstones from anon;
revoke all on table public.seed_sync_conflicts from anon;
grant select on table public.seed_tombstones to authenticated;
grant select on table public.seed_sync_conflicts to authenticated;

create or replace function public.apply_seed_mutation(
  p_mutation_id text,
  p_entity_type text,
  p_action text,
  p_entity_id text,
  p_payload jsonb default null,
  p_base_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  previous_result jsonb;
  current_revision bigint;
  current_value jsonb;
  counter_revision bigint;
  next_revision bigint;
  has_conflict boolean := false;
  mutation_result jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_mutation_id is null or length(p_mutation_id) < 8 or length(p_mutation_id) > 180 then
    raise exception 'Invalid mutation id' using errcode = '22023';
  end if;
  if p_entity_type not in ('note', 'planet') or p_action not in ('upsert', 'delete') then
    raise exception 'Invalid mutation kind' using errcode = '22023';
  end if;
  if p_entity_id is null or length(p_entity_id) = 0 or length(p_entity_id) > 180 then
    raise exception 'Invalid entity id' using errcode = '22023';
  end if;
  if p_action = 'upsert' and (p_payload is null or p_payload->>'id' is distinct from p_entity_id) then
    raise exception 'Payload id does not match entity id' using errcode = '22023';
  end if;

  insert into public.seed_sync_counters (user_id, revision)
  values (caller_id, 0)
  on conflict (user_id) do nothing;

  select counters.revision into counter_revision
  from public.seed_sync_counters as counters
  where counters.user_id = caller_id
  for update;

  -- The per-user lock makes duplicate concurrent requests idempotent too.
  select applied.result into previous_result
  from public.seed_applied_mutations as applied
  where applied.user_id = caller_id and applied.mutation_id = p_mutation_id;
  if found then
    return previous_result;
  end if;

  current_revision := null;
  current_value := null;
  if p_entity_type = 'note' then
    select notes.server_revision,
      notes.data || jsonb_build_object('syncVersion', notes.server_revision)
    into current_revision, current_value
    from public.seed_notes as notes
    where notes.user_id = caller_id and notes.id = p_entity_id;
  else
    select planets.server_revision,
      jsonb_build_object(
        'id', planets.id,
        'name', planets.name,
        'description', coalesce(planets.description, ''),
        'theme', planets.theme,
        'createdAt', planets.created_at_ms,
        'updatedAt', (extract(epoch from planets.updated_at) * 1000)::bigint,
        'syncVersion', planets.server_revision
      )
    into current_revision, current_value
    from public.seed_planets as planets
    where planets.user_id = caller_id and planets.id = p_entity_id;
  end if;

  if current_revision is null then
    select tombstones.server_revision,
      jsonb_build_object('deleted', true, 'syncVersion', tombstones.server_revision)
    into current_revision, current_value
    from public.seed_tombstones as tombstones
    where tombstones.user_id = caller_id
      and tombstones.entity_type = p_entity_type
      and tombstones.entity_id = p_entity_id;
  end if;
  current_revision := coalesce(current_revision, 0);
  has_conflict := p_base_revision is not null and p_base_revision <> current_revision;

  if has_conflict then
    insert into public.seed_sync_conflicts (
      user_id, entity_type, entity_id, base_revision, displaced_revision, displaced_value, incoming_value
    ) values (
      caller_id, p_entity_type, p_entity_id, p_base_revision, current_revision, current_value, p_payload
    );
  end if;

  next_revision := counter_revision + 1;
  update public.seed_sync_counters set revision = next_revision where user_id = caller_id;

  if p_entity_type = 'note' and p_action = 'upsert' then
    insert into public.seed_notes (id, user_id, planet_id, data, updated_at, server_revision)
    values (
      p_entity_id,
      caller_id,
      coalesce(nullif(p_payload->>'planetId', ''), 'personal'),
      p_payload - 'syncVersion',
      now(),
      next_revision
    )
    on conflict (id, user_id) do update set
      planet_id = excluded.planet_id,
      data = excluded.data,
      updated_at = excluded.updated_at,
      server_revision = excluded.server_revision;
    delete from public.seed_tombstones
    where user_id = caller_id and entity_type = 'note' and entity_id = p_entity_id;
  elsif p_entity_type = 'planet' and p_action = 'upsert' then
    insert into public.seed_planets (id, user_id, name, description, theme, created_at_ms, updated_at, server_revision)
    values (
      p_entity_id,
      caller_id,
      left(coalesce(p_payload->>'name', 'Mi jardín'), 180),
      left(coalesce(p_payload->>'description', ''), 2000),
      coalesce(nullif(p_payload->>'theme', ''), 'earth'),
      coalesce((p_payload->>'createdAt')::bigint, (extract(epoch from now()) * 1000)::bigint),
      now(),
      next_revision
    )
    on conflict (id, user_id) do update set
      name = excluded.name,
      description = excluded.description,
      theme = excluded.theme,
      updated_at = excluded.updated_at,
      server_revision = excluded.server_revision;
    delete from public.seed_tombstones
    where user_id = caller_id and entity_type = 'planet' and entity_id = p_entity_id;
  elsif p_entity_type = 'note' and p_action = 'delete' then
    delete from public.seed_notes where user_id = caller_id and id = p_entity_id;
    insert into public.seed_tombstones (user_id, entity_type, entity_id, server_revision, deleted_at)
    values (caller_id, 'note', p_entity_id, next_revision, now())
    on conflict (user_id, entity_type, entity_id) do update set
      server_revision = excluded.server_revision,
      deleted_at = excluded.deleted_at;
  else
    insert into public.seed_tombstones (user_id, entity_type, entity_id, server_revision, deleted_at)
    select caller_id, 'note', notes.id, next_revision, now()
    from public.seed_notes as notes
    where notes.user_id = caller_id and notes.planet_id = p_entity_id
    on conflict (user_id, entity_type, entity_id) do update set
      server_revision = excluded.server_revision,
      deleted_at = excluded.deleted_at;
    delete from public.seed_notes where user_id = caller_id and planet_id = p_entity_id;
    delete from public.seed_planets where user_id = caller_id and id = p_entity_id;
    insert into public.seed_tombstones (user_id, entity_type, entity_id, server_revision, deleted_at)
    values (caller_id, 'planet', p_entity_id, next_revision, now())
    on conflict (user_id, entity_type, entity_id) do update set
      server_revision = excluded.server_revision,
      deleted_at = excluded.deleted_at;
  end if;

  mutation_result := jsonb_build_object(
    'status', 'applied',
    'revision', next_revision,
    'conflict', has_conflict,
    'previousRevision', current_revision
  );
  insert into public.seed_applied_mutations (user_id, mutation_id, result)
  values (caller_id, p_mutation_id, mutation_result);
  return mutation_result;
end;
$$;

revoke all on function public.apply_seed_mutation(text, text, text, text, jsonb, bigint) from public, anon;
grant execute on function public.apply_seed_mutation(text, text, text, text, jsonb, bigint) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seed_tombstones'
  ) then
    alter publication supabase_realtime add table public.seed_tombstones;
  end if;
end $$;
