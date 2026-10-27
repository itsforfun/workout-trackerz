-- Steps tab (Apple Health via an iPhone Shortcut). Run in Supabase → SQL Editor.
-- Safe to run more than once. Then deploy supabase/functions/steps-ingest (JWT verification OFF).

-- One row per user per day
create table if not exists public.step_counts (
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null,
    steps int not null check (steps >= 0),
    source text not null default 'manual',      -- 'shortcut' or 'manual'
    updated_at timestamptz not null default now(),
    primary key (user_id, date)
);
alter table public.step_counts enable row level security;
drop policy if exists "Users manage own steps" on public.step_counts;
create policy "Users manage own steps" on public.step_counts
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.step_counts to authenticated;

-- Private key the Shortcut sends instead of a login; it can only write step counts
create table if not exists public.step_tokens (
    user_id uuid primary key references auth.users(id) on delete cascade,
    token text not null unique,
    created_at timestamptz not null default now()
);
alter table public.step_tokens enable row level security;
drop policy if exists "Users manage own step token" on public.step_tokens;
create policy "Users manage own step token" on public.step_tokens
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.step_tokens to authenticated;

notify pgrst, 'reload schema';
