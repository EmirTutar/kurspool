-- Stars for course items and notes. Both are private to the person who set them.

alter table public.notes add column starred boolean not null default false;

create table public.item_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index on public.item_favorites (item_id);

revoke all on public.item_favorites from anon, authenticated;
grant all on public.item_favorites to service_role;
grant select, insert, delete on public.item_favorites to authenticated;

alter table public.item_favorites enable row level security;

create policy "users read own favorites" on public.item_favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users star their batch's items" on public.item_favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and item_id in (select id from public.items));
create policy "users remove own favorites" on public.item_favorites
  for delete to authenticated using (user_id = (select auth.uid()));
