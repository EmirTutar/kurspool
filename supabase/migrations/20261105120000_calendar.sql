-- Course calendars read from secret iCal addresses, and each person's saved calendar choices.

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  title text not null,
  is_cohort boolean not null default false,
  last_synced_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (batch_id, title)
);

-- The address gives anyone who has it the whole calendar, so it is kept apart and encrypted.
create table public.calendar_sources (
  calendar_id uuid primary key references public.calendars (id) on delete cascade,
  encrypted_url text not null
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  event_key text not null,
  uid text not null,
  title text not null,
  description text,
  location text,
  meeting_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  cancelled_at timestamptz,
  unique (calendar_id, event_key)
);
create index on public.calendar_events (calendar_id, starts_at);

create table public.calendar_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cohort_ids uuid[] not null default '{}',
  hidden_groups text[] not null default '{}',
  view text not null default 'week' check (view in ('month', 'week', 'day')),
  updated_at timestamptz not null default now()
);

revoke all on public.calendars, public.calendar_sources, public.calendar_events, public.calendar_preferences from anon, authenticated;
grant all on public.calendars, public.calendar_sources, public.calendar_events, public.calendar_preferences to service_role;
grant select on public.calendars, public.calendar_events to authenticated;
grant select, insert, update on public.calendar_preferences to authenticated;

alter table public.calendars enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_preferences enable row level security;

-- calendar_sources intentionally has no policies and no grants for signed-in users.

create policy "members read their calendars" on public.calendars
  for select to authenticated using (batch_id = (select public.current_batch_id()));

create policy "members read their calendar events" on public.calendar_events
  for select to authenticated
  using (calendar_id in (select id from public.calendars where batch_id = (select public.current_batch_id())));

create policy "users read own calendar choices" on public.calendar_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users add own calendar choices" on public.calendar_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users edit own calendar choices" on public.calendar_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
