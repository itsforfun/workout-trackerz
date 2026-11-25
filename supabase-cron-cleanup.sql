-- Odyr: keep the scheduler's run log small (2026-11-25).
-- pg_cron writes one row to cron.job_run_details on every run and never deletes it.
-- With rest-push every 5 seconds that is ~17,000 rows a day: by Nov 2026 the log held
-- 431,000 rows and 1.6 GB, almost the whole database, which is what took it down.
-- Safe to run more than once. Rest alerts keep working exactly as before.

-- 1. Empty the log now (it only records past runs; nothing reads it).
truncate cron.job_run_details;

-- 2. Every hour, delete log rows older than one day.
select cron.unschedule('cron-log-cleanup') where exists (select 1 from cron.job where jobname = 'cron-log-cleanup');
select cron.schedule('cron-log-cleanup', '23 * * * *', $$delete from cron.job_run_details where end_time < now() - interval '1 day'$$);

-- 3. Show the result: database size and the jobs now scheduled.
select pg_size_pretty(pg_database_size(current_database())) as database_size,
       (select string_agg(jobname || ' (' || schedule || ')', ', ') from cron.job) as jobs;
