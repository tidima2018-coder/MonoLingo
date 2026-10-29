-- Run this file once in the Supabase SQL Editor.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null check (char_length(username) between 1 and 32),
 email text not null,
 role text not null default 'user' check (role in ('user','admin')),
 games_played integer not null default 0 check (games_played >= 0),
 wins integer not null default 0 check (wins >= 0),
 losses integer not null default 0 check (losses >= 0),
 draws integer not null default 0 check (draws >= 0),
 puzzles_solved integer not null default 0 check (puzzles_solved >= 0),
 xp integer not null default 0 check (xp >= 0),
 completed_stages integer[] not null default '{}',
 daily_dates text[] not null default '{}',
 daily_streak integer not null default 0 check (daily_streak >= 0),
 last_daily_date text not null default '',
 created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists draws integer not null default 0 check (draws >= 0);

create table if not exists public.reviews (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 username text not null,
 message text not null check (char_length(message) between 3 and 2000),
 created_at timestamptz not null default now()
);

create table if not exists public.puzzle_completions (
 user_id uuid not null references auth.users(id) on delete cascade,
 puzzle_id text not null,
 created_at timestamptz not null default now(),
 primary key (user_id,puzzle_id)
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
 insert into public.profiles (id,username,email)
 values (
  new.id,
  coalesce(nullif(btrim(new.raw_user_meta_data->>'username'),''),'Player'),
  coalesce(new.email,'')
 )
 on conflict (id) do update
  set email=excluded.email;
 return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
 after insert on auth.users
 for each row execute function public.create_profile_for_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
 select exists (
  select 1 from public.profiles
  where id=(select auth.uid()) and role='admin'
 );
$$;

alter table public.profiles enable row level security;
alter table public.reviews enable row level security;
alter table public.puzzle_completions enable row level security;

drop policy if exists "Users read own profile and admins read all" on public.profiles;
create policy "Users read own profile and admins read all"
 on public.profiles for select to authenticated
 using (id=(select auth.uid()) or (select public.is_admin()));

drop policy if exists "Users create own reviews" on public.reviews;
create policy "Users create own reviews"
 on public.reviews for insert to authenticated
 with check (
  user_id=(select auth.uid())
  and username=(select p.username from public.profiles p where p.id=(select auth.uid()))
 );

drop policy if exists "Admins read reviews" on public.reviews;
create policy "Admins read reviews"
 on public.reviews for select to authenticated
 using ((select public.is_admin()));

drop policy if exists "Users read own puzzle completions" on public.puzzle_completions;
create policy "Users read own puzzle completions"
 on public.puzzle_completions for select to authenticated
 using (user_id=(select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username, email) on table public.profiles to authenticated;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id=(select auth.uid()) and role='user');
revoke all on public.reviews from anon, authenticated;
grant select,insert on public.reviews to authenticated;
revoke all on public.puzzle_completions from anon, authenticated;
grant select on public.puzzle_completions to authenticated;

create or replace function public.record_game_started()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.profiles set games_played=games_played+1 where id=auth.uid();
 if not found then raise exception 'Profile not found'; end if;
end;
$$;
create or replace function public.record_game_result(p_result text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_result not in ('win','loss','draw') then raise exception 'Invalid game result'; end if;
 update public.profiles
 set wins=wins+case when p_result='win' then 1 else 0 end,
     losses=losses+case when p_result='loss' then 1 else 0 end,
     draws=draws+case when p_result='draw' then 1 else 0 end
 where id=auth.uid();
 if not found then raise exception 'Profile not found'; end if;
end;
$$;

create or replace function public.record_puzzle_solved(p_puzzle_id text,p_xp_gained integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_puzzle_id is null or char_length(p_puzzle_id) not between 1 and 100 then raise exception 'Invalid puzzle id'; end if;
 if p_xp_gained is null or p_xp_gained not between 0 and 100 then raise exception 'Invalid XP amount'; end if;
 insert into public.puzzle_completions(user_id,puzzle_id)
 values (auth.uid(),p_puzzle_id)
 on conflict (user_id,puzzle_id) do nothing;
 if not found then return false; end if;
 update public.profiles
 set puzzles_solved=puzzles_solved+1,xp=xp+p_xp_gained
 where id=auth.uid();
 if not found then raise exception 'Profile not found'; end if;
 return true;
end;
$$;

create or replace function public.sync_profile_progress(
 p_completed_stages integer[],
 p_daily_dates text[],
 p_daily_streak integer,
 p_last_daily_date text,
 p_legacy_wins integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if cardinality(coalesce(p_completed_stages,'{}'))>100
    or exists(select 1 from unnest(coalesce(p_completed_stages,'{}')) value where value<0 or value>1000)
 then raise exception 'Invalid completed stage data'; end if;
 if cardinality(coalesce(p_daily_dates,'{}'))>3660
    or exists(select 1 from unnest(coalesce(p_daily_dates,'{}')) value where value !~ '^\d{4}-\d{2}-\d{2}$')
 then raise exception 'Invalid daily progress data'; end if;
 if coalesce(p_daily_streak,0)<0 or coalesce(p_legacy_wins,0)<0 then raise exception 'Invalid progress counters'; end if;
 update public.profiles
 set completed_stages=(
      select coalesce(array_agg(distinct value order by value),'{}')
      from unnest(completed_stages||coalesce(p_completed_stages,'{}')) value
     ),
     daily_dates=(
      select coalesce(array_agg(distinct value order by value desc),'{}')
      from (select value from unnest(daily_dates||coalesce(p_daily_dates,'{}')) value order by value desc limit 60) dates
     ),
     daily_streak=greatest(daily_streak,coalesce(p_daily_streak,0)),
     last_daily_date=greatest(last_daily_date,coalesce(p_last_daily_date,''))
 where id=auth.uid();
 if not found then raise exception 'Profile not found'; end if;
end;
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.record_game_started() from public, anon;
grant execute on function public.record_game_started() to authenticated;
revoke all on function public.record_game_result(text) from public, anon;
grant execute on function public.record_game_result(text) to authenticated;
revoke all on function public.record_puzzle_solved(text,integer) from public, anon;
grant execute on function public.record_puzzle_solved(text,integer) to authenticated;
revoke all on function public.sync_profile_progress(integer[],text[],integer,text,integer) from public, anon;
grant execute on function public.sync_profile_progress(integer[],text[],integer,text,integer) to authenticated;

-- Opening-course progress is merged across devices just like the main learning path.
alter table public.profiles
 add column if not exists completed_openings text[] not null default '{}';

create or replace function public.sync_opening_progress(p_completed_openings text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if cardinality(coalesce(p_completed_openings,'{}')) > 100
    or exists (
      select 1 from unnest(coalesce(p_completed_openings,'{}')) value
      where char_length(value) not between 1 and 100
    )
 then raise exception 'Invalid opening progress'; end if;
 update public.profiles
 set completed_openings=(
   select coalesce(array_agg(distinct value order by value),'{}')
   from unnest(completed_openings || coalesce(p_completed_openings,'{}')) value
 )
 where id=auth.uid();
 if not found then raise exception 'Profile not found'; end if;
end;
$$;
revoke all on function public.sync_opening_progress(text[]) from public, anon;
grant execute on function public.sync_opening_progress(text[]) to authenticated;
