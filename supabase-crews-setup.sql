-- Odyr crews (v1.66): small private groups (up to 8) that travel together.
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
-- Privacy: a member sees only their own crew: its name, the members' chosen display names and each
-- member's activity this week (leagues, workouts). No emails, no weights, nothing else.
-- Joining needs the crew's invite code; codes are only readable by the crew's own members.

create table if not exists public.crews (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 1 and 40),
    code text not null unique,
    created_by uuid not null references auth.users on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
    crew_id uuid not null references public.crews on delete cascade,
    user_id uuid not null references auth.users on delete cascade,
    display_name text not null check (char_length(display_name) between 1 and 24),
    joined_at timestamptz not null default now(),
    week_start date,
    week_leagues integer not null default 0 check (week_leagues between 0 and 100000),
    week_workouts integer not null default 0 check (week_workouts between 0 and 100),
    updated_at timestamptz not null default now(),
    primary key (crew_id, user_id)
);
-- One crew per person for now
create unique index if not exists crew_members_one_crew on public.crew_members (user_id);

create table if not exists public.crew_horns (
    id bigint generated always as identity primary key,
    crew_id uuid not null references public.crews on delete cascade,
    from_user uuid not null references auth.users on delete cascade,
    to_user uuid not null references auth.users on delete cascade,
    at timestamptz not null default now()
);
create index if not exists crew_horns_to on public.crew_horns (to_user, at desc);

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_horns enable row level security;

-- Membership check that doesn't recurse through crew_members' own policies
create or replace function public.is_crew_member(c uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select exists (select 1 from public.crew_members where crew_id = c and user_id = auth.uid());
$$;

drop policy if exists "members read their crew" on public.crews;
create policy "members read their crew" on public.crews for select using (public.is_crew_member(id));

drop policy if exists "members read their crewmates" on public.crew_members;
create policy "members read their crewmates" on public.crew_members for select using (public.is_crew_member(crew_id));
drop policy if exists "members update their own row" on public.crew_members;
create policy "members update their own row" on public.crew_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "members leave" on public.crew_members;
create policy "members leave" on public.crew_members for delete using (user_id = auth.uid());

drop policy if exists "horns between crewmates" on public.crew_horns;
create policy "horns between crewmates" on public.crew_horns for insert
    with check (from_user = auth.uid() and public.is_crew_member(crew_id)
        and exists (select 1 from public.crew_members m where m.crew_id = crew_horns.crew_id and m.user_id = crew_horns.to_user));
drop policy if exists "read horns sent to me" on public.crew_horns;
create policy "read horns sent to me" on public.crew_horns for select using (to_user = auth.uid());

-- Create a crew (you become its first member); returns its invite code
create or replace function public.create_crew(crew_name text, display text)
returns text language plpgsql security definer set search_path = public as $$
declare new_id uuid; new_code text;
begin
    if auth.uid() is null then raise exception 'not signed in'; end if;
    if exists (select 1 from public.crew_members where user_id = auth.uid()) then raise exception 'already in a crew'; end if;
    loop
        -- 6 letters/digits without look-alikes (0/O, 1/I)
        new_code := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 6));
        exit when char_length(new_code) = 6 and not exists (select 1 from public.crews where code = new_code);
    end loop;
    insert into public.crews (name, code, created_by) values (trim(crew_name), new_code, auth.uid()) returning id into new_id;
    insert into public.crew_members (crew_id, user_id, display_name) values (new_id, auth.uid(), trim(display));
    return new_code;
end $$;

-- Join with an invite code (8 members at most)
create or replace function public.join_crew(invite text, display text)
returns uuid language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
    if auth.uid() is null then raise exception 'not signed in'; end if;
    if exists (select 1 from public.crew_members where user_id = auth.uid()) then raise exception 'already in a crew'; end if;
    select id into target from public.crews where code = upper(trim(invite));
    if target is null then raise exception 'no crew with that code'; end if;
    if (select count(*) from public.crew_members where crew_id = target) >= 8 then raise exception 'crew is full'; end if;
    insert into public.crew_members (crew_id, user_id, display_name) values (target, auth.uid(), trim(display));
    return target;
end $$;

revoke all on function public.create_crew(text, text) from public, anon;
revoke all on function public.join_crew(text, text) from public, anon;
grant execute on function public.create_crew(text, text) to authenticated;
grant execute on function public.join_crew(text, text) to authenticated;

-- Old horns are cleared after 30 days
create extension if not exists pg_cron;
select cron.unschedule('crew-horns-cleanup') where exists (select 1 from cron.job where jobname = 'crew-horns-cleanup');
select cron.schedule('crew-horns-cleanup', '0 4 * * *', $$delete from public.crew_horns where at < now() - interval '30 days'$$);
