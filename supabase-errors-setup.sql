-- Error reports (v1.38): the app records unexpected errors here so they can be fixed before anyone reports them.
-- Anyone using the app may add a row; nobody can read rows through the app. View them in Supabase → Table Editor → error_log.
-- Safe to run more than once.

create table if not exists public.error_log (
    id bigserial primary key,
    at timestamptz not null default now(),
    user_id uuid,
    version text,
    message text,
    source text,
    stack text,
    screen text,
    agent text
);

alter table public.error_log enable row level security;

drop policy if exists "anyone can report an error" on public.error_log;
create policy "anyone can report an error" on public.error_log
    for insert to anon, authenticated
    with check (char_length(coalesce(message, '')) <= 500 and char_length(coalesce(stack, '')) <= 2000);

-- Keep 90 days of reports
create extension if not exists pg_cron;
select cron.unschedule('error-log-cleanup') where exists (select 1 from cron.job where jobname = 'error-log-cleanup');
select cron.schedule('error-log-cleanup', '17 3 * * *', $$delete from public.error_log where at < now() - interval '90 days'$$);
