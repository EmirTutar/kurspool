-- Kurspool foundation: schema, helper functions and access rules.
-- Imported content and sync credentials are written only by server code using the service role.

create type public.member_role as enum ('student', 'maintainer');
create type public.item_kind as enum ('coursework', 'material', 'announcement');
create type public.item_category as enum ('session', 'recording', 'feedback', 'reading', 'organization', 'other');
create type public.item_status as enum ('todo', 'done', 'skipped');
create type public.attachment_type as enum ('link', 'driveFile', 'youtubeVideo', 'form');
create type public.sync_status as enum ('running', 'success', 'partial', 'failed');

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.batch_allowed_emails (
  batch_id uuid not null references public.batches (id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.member_role not null default 'student',
  created_at timestamptz not null default now(),
  primary key (batch_id, email)
);
create index on public.batch_allowed_emails (email);

-- One row per user: each user belongs to one batch in the MVP.
create table public.batch_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  role public.member_role not null default 'student',
  joined_at timestamptz not null default now()
);
create index on public.batch_members (batch_id);

create table public.quick_links (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  label text not null,
  url text not null check (url ~* '^https?://'),
  icon text,
  position integer not null default 0
);
create index on public.quick_links (batch_id);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  classroom_course_id text not null unique,
  title text not null,
  position integer not null default 0,
  classroom_url text
);
create index on public.modules (batch_id);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  classroom_topic_id text not null,
  title text not null,
  unique (module_id, classroom_topic_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  classroom_id text not null,
  kind public.item_kind not null,
  category public.item_category not null default 'other',
  title text not null,
  description text,
  classroom_url text,
  posted_at timestamptz,
  classroom_updated_at timestamptz,
  due_at timestamptz,
  hidden_at timestamptz,
  unique (module_id, kind, classroom_id)
);
create index on public.items (topic_id);

create table public.item_attachments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  type public.attachment_type not null,
  title text,
  url text
);
create index on public.item_attachments (item_id);

-- No row means the item is New for that user.
create table public.item_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  status public.item_status not null default 'todo',
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index on public.item_progress (item_id);

create table public.personal_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  title text not null,
  done boolean not null default false,
  due_on date,
  created_at timestamptz not null default now()
);
create index on public.personal_tasks (user_id);
create index on public.personal_tasks (item_id);

create table public.user_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  url text not null check (url ~* '^https?://'),
  icon text,
  position integer not null default 0
);
create index on public.user_links (user_id);

create table public.sync_credentials (
  batch_id uuid primary key references public.batches (id) on delete cascade,
  encrypted_refresh_token text not null,
  connected_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  status public.sync_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb,
  error text
);
create index on public.sync_runs (batch_id, started_at desc);

-- Helpers used by policies. They run as definer so policies don't recurse on batch_members.
create function public.current_batch_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select batch_id from public.batch_members where user_id = (select auth.uid());
$$;

create function public.is_batch_maintainer(target_batch uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.batch_members
    where user_id = (select auth.uid()) and batch_id = target_batch and role = 'maintainer'
  );
$$;

-- The only way into a batch. Returns the batch ID, or null if the user's confirmed email isn't listed.
create function public.join_batch_if_allowed()
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  allowed record;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select a.batch_id, a.role into allowed
  from auth.users u
  join public.batch_allowed_emails a on a.email = lower(u.email)
  where u.id = uid and u.email_confirmed_at is not null
  order by a.created_at, a.batch_id
  limit 1;

  if not found then
    delete from public.batch_members where user_id = uid;
    return null;
  end if;

  insert into public.batch_members (user_id, batch_id, role)
  values (uid, allowed.batch_id, allowed.role)
  on conflict (user_id) do update set batch_id = excluded.batch_id, role = excluded.role;

  return allowed.batch_id;
end;
$$;

-- Removing an email from the batch list ends that person's access right away.
create function public.remove_member_for_deleted_email()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.batch_members m
  using auth.users u
  where m.user_id = u.id and m.batch_id = old.batch_id and lower(u.email) = old.email;
  return old;
end;
$$;

create trigger batch_allowed_emails_after_delete
after delete on public.batch_allowed_emails
for each row execute function public.remove_member_for_deleted_email();

revoke all on function public.current_batch_id() from public, anon;
revoke all on function public.is_batch_maintainer(uuid) from public, anon;
revoke all on function public.join_batch_if_allowed() from public, anon;
revoke all on function public.remove_member_for_deleted_email() from public, anon, authenticated;
grant execute on function public.current_batch_id() to authenticated;
grant execute on function public.is_batch_maintainer(uuid) to authenticated;
grant execute on function public.join_batch_if_allowed() to authenticated;

-- Table privileges: nothing for anonymous visitors, the minimum for signed-in users.
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant select on
  public.batches, public.batch_members, public.modules, public.topics,
  public.items, public.item_attachments, public.sync_runs
to authenticated;
grant select, insert, update, delete on
  public.batch_allowed_emails, public.quick_links,
  public.item_progress, public.personal_tasks, public.user_links
to authenticated;

alter table public.batches enable row level security;
alter table public.batch_allowed_emails enable row level security;
alter table public.batch_members enable row level security;
alter table public.quick_links enable row level security;
alter table public.modules enable row level security;
alter table public.topics enable row level security;
alter table public.items enable row level security;
alter table public.item_attachments enable row level security;
alter table public.item_progress enable row level security;
alter table public.personal_tasks enable row level security;
alter table public.user_links enable row level security;
alter table public.sync_credentials enable row level security;
alter table public.sync_runs enable row level security;

-- sync_credentials intentionally has no policies and no grants.

create policy "members read their batch" on public.batches
  for select to authenticated using (id = (select public.current_batch_id()));

create policy "maintainers manage the batch list" on public.batch_allowed_emails
  for all to authenticated
  using ((select public.is_batch_maintainer(batch_id)))
  with check ((select public.is_batch_maintainer(batch_id)));

create policy "users read own membership, maintainers read their batch" on public.batch_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_batch_maintainer(batch_id)));

create policy "members read quick links" on public.quick_links
  for select to authenticated using (batch_id = (select public.current_batch_id()));
create policy "maintainers add quick links" on public.quick_links
  for insert to authenticated with check ((select public.is_batch_maintainer(batch_id)));
create policy "maintainers edit quick links" on public.quick_links
  for update to authenticated
  using ((select public.is_batch_maintainer(batch_id)))
  with check ((select public.is_batch_maintainer(batch_id)));
create policy "maintainers remove quick links" on public.quick_links
  for delete to authenticated using ((select public.is_batch_maintainer(batch_id)));

create policy "members read modules" on public.modules
  for select to authenticated using (batch_id = (select public.current_batch_id()));

create policy "members read topics" on public.topics
  for select to authenticated
  using (exists (select 1 from public.modules m where m.id = module_id));

create policy "members read visible items" on public.items
  for select to authenticated
  using (hidden_at is null and exists (select 1 from public.modules m where m.id = module_id));

create policy "members read attachments" on public.item_attachments
  for select to authenticated
  using (exists (select 1 from public.items i where i.id = item_id));

create policy "users manage own progress" on public.item_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.items i where i.id = item_id)
  );

create policy "users manage own tasks" on public.personal_tasks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (item_id is null or exists (select 1 from public.items i where i.id = item_id))
  );

create policy "users manage own links" on public.user_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "maintainers read sync history" on public.sync_runs
  for select to authenticated using ((select public.is_batch_maintainer(batch_id)));
