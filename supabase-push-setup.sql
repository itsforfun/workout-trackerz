-- Lock-screen rest alerts (Web Push). Run in Supabase → SQL Editor AFTER supabase-setup.sql.
-- Safe to run more than once.
--
-- The four values marked <...> are filled in when this is copied for you; the real keys are
-- never committed to the repo. The private key and cron secret live only in push_config,
-- which only the rest-push function (service role) can read.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Each device that turned on rest alerts
create table if not exists public.push_subscriptions (
    endpoint text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    p256dh text not null,
    auth text not null,
    created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- At most one pending "rest over" alert per user
create table if not exists public.rest_timers (
    user_id uuid primary key references auth.users(id) on delete cascade,
    fire_at timestamptz not null,
    title text,
    body text
);
alter table public.rest_timers enable row level security;
drop policy if exists "Users manage own rest timer" on public.rest_timers;
create policy "Users manage own rest timer" on public.rest_timers
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.rest_timers to authenticated;

-- Server-only settings: RLS on and no policies, so the app can't read them
create table if not exists public.push_config (
    key text primary key,
    value text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

insert into public.push_config (key, value) values
    ('vapid_public', '<VAPID_PUBLIC_KEY>'),
    ('vapid_private', '<VAPID_PRIVATE_KEY>'),
    ('vapid_subject', 'https://itsforfun.github.io/workout-trackerz/'),
    ('cron_secret', '<CRON_SECRET>'),
    ('function_url', '<PROJECT_URL>/functions/v1/rest-push')
on conflict (key) do update set value = excluded.value;

-- Delivery results (status code + push service host) for troubleshooting; readable by anyone, holds nothing personal
create table if not exists public.push_log (
    id bigint generated always as identity primary key,
    at timestamptz not null default now(),
    status int,
    note text
);
alter table public.push_log enable row level security;
drop policy if exists "Push log is readable" on public.push_log;
create policy "Push log is readable" on public.push_log for select using (true);
grant select on public.push_log to anon, authenticated;

-- Every 5 seconds: call rest-push only when a timer is due, and clear anything stuck for 10+ minutes
select cron.unschedule(jobid) from cron.job where jobname = 'rest-push';
select cron.schedule('rest-push', '5 seconds', $job$
    select net.http_post(
        url := (select value from public.push_config where key = 'function_url'),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (select value from public.push_config where key = 'cron_secret')
        ),
        body := '{}'::jsonb
    )
    where exists (select 1 from public.rest_timers where fire_at <= now());
    delete from public.rest_timers where fire_at < now() - interval '10 minutes';
    delete from public.push_log where at < now() - interval '7 days';
$job$);

notify pgrst, 'reload schema';
