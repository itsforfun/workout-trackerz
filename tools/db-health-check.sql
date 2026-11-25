-- Odyr database health check (read-only: changes nothing).
-- Paste into Supabase → SQL Editor → Run, then screenshot the result.
select 'cron run log rows' as what, count(*)::text as value from cron.job_run_details
union all
select 'cron run log size', pg_size_pretty(pg_total_relation_size('cron.job_run_details'))
union all
select 'cron runs, last hour', count(*)::text from cron.job_run_details where start_time > now() - interval '1 hour'
union all
select 'cron failures, last day', count(*)::text from cron.job_run_details where status = 'failed' and start_time > now() - interval '1 day'
union all
select 'oldest cron log entry', min(start_time)::text from cron.job_run_details
union all
select 'web call log rows', count(*)::text from net._http_response
union all
select 'whole database size', pg_size_pretty(pg_database_size(current_database()))
union all
select 'open connections', count(*)::text from pg_stat_activity
union all
select 'rest timers waiting', count(*)::text from public.rest_timers
union all
select 'scheduled reminders', count(*)::text from public.scheduled_pushes
union all
select 'push log rows', count(*)::text from public.push_log
union all
select 'error log rows', count(*)::text from public.error_log
union all
select 'job: ' || jobname, schedule || ' · ' || case when active then 'on' else 'off' end from cron.job;
