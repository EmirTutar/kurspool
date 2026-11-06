-- Private notes, optionally tied to one course item, and a shared idea list per batch.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A note outlives its item: if the item is ever deleted, the note stays as a note of its own.
  item_id uuid references public.items (id) on delete set null,
  title text check (title is null or char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One note per person and item. Notes without an item don't collide, since nulls are distinct.
  unique (user_id, item_id)
);
create index on public.notes (user_id, updated_at desc);
create index on public.notes (item_id);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.ideas (batch_id, created_at desc);

revoke all on public.notes, public.ideas from anon, authenticated;
grant all on public.notes, public.ideas to service_role;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, delete on public.ideas to authenticated;

alter table public.notes enable row level security;
alter table public.ideas enable row level security;

-- The item check reads items under the person's own access rules, so a note can only point at their batch's material.
create policy "users read own notes" on public.notes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users add own notes" on public.notes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (item_id is null or item_id in (select id from public.items)));
create policy "users edit own notes" on public.notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (item_id is null or item_id in (select id from public.items)));
create policy "users remove own notes" on public.notes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "members read their batch's ideas" on public.ideas
  for select to authenticated using (batch_id = (select public.current_batch_id()));
create policy "members add ideas to their batch" on public.ideas
  for insert to authenticated
  with check (user_id = (select auth.uid()) and batch_id = (select public.current_batch_id()));
create policy "authors and maintainers remove ideas" on public.ideas
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_batch_maintainer(batch_id)));
