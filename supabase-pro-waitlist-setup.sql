-- Odyr Pro waitlist (v1.39): who wants Pro, what matters to them, and what price feels fair.
-- Each person can add and change only their own answer; nobody can read other people's.
-- See the totals in Supabase → Table Editor → pro_waitlist. Safe to run more than once.

create table if not exists public.pro_waitlist (
    user_id uuid primary key references auth.users on delete cascade,
    email text,
    interests text[] default '{}',
    price text,
    currency text,
    lang text,
    joined_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.pro_waitlist enable row level security;

drop policy if exists "own waitlist row: read" on public.pro_waitlist;
drop policy if exists "own waitlist row: add" on public.pro_waitlist;
drop policy if exists "own waitlist row: change" on public.pro_waitlist;
create policy "own waitlist row: read" on public.pro_waitlist for select to authenticated using (auth.uid() = user_id);
create policy "own waitlist row: add" on public.pro_waitlist for insert to authenticated with check (auth.uid() = user_id);
create policy "own waitlist row: change" on public.pro_waitlist for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
