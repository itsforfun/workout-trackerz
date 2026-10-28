-- Reminders + cardio from Apple Health (app v1.21). Run in Supabase → SQL Editor.
-- Safe to run more than once. Needs supabase-push-setup.sql and supabase-steps-setup.sql run first.
-- Then redeploy the rest-push and steps-ingest functions with the updated code.

-- Lock-screen reminders planned by the app (workout days, streak at risk, steps)
create table if not exists public.scheduled_pushes (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    fire_at timestamptz not null,
    kind text not null,              -- 'workout' | 'streak' | 'steps'
    title text,
    body text,
    day date                         -- local date the steps reminder is about
);
create index if not exists scheduled_pushes_fire_at on public.scheduled_pushes (fire_at);
alter table public.scheduled_pushes enable row level security;
drop policy if exists "Users manage own reminders" on public.scheduled_pushes;
create policy "Users manage own reminders" on public.scheduled_pushes
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.scheduled_pushes to authenticated;

-- Apple Health exercise minutes, sent by the "Workout Steps" Shortcut next to the step count
alter table public.step_counts add column if not exists exercise_minutes int check (exercise_minutes >= 0);

-- The scheduler now also wakes rest-push when a reminder is due
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
    where exists (select 1 from public.rest_timers where fire_at <= now())
       or exists (select 1 from public.scheduled_pushes where fire_at <= now());
    delete from public.rest_timers where fire_at < now() - interval '10 minutes';
    delete from public.scheduled_pushes where fire_at < now() - interval '1 hour';
    delete from public.push_log where at < now() - interval '7 days';
$job$);

notify pgrst, 'reload schema';
