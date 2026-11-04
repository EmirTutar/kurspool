-- Students can't read sync_runs, but they should see how fresh their data is.
alter table public.batches add column last_synced_at timestamptz;
