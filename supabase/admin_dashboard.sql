-- Run in Supabase SQL Editor after replacing YOUR_MASTER_PASSWORD below.
-- On repeat runs, use the current master password so the upsert keeps it unchanged.
create extension if not exists pgcrypto with schema extensions;
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists draws integer not null default 0 check (draws >= 0);
alter table public.profiles enable row level security;
alter table public.reviews enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, username, email) on table public.profiles to authenticated;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id=(select auth.uid()) and role='user');
revoke all on table public.reviews from anon, authenticated;
grant insert on table public.reviews to authenticated;
drop policy if exists "Users read own profile and admins read all" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id=(select auth.uid()));
drop policy if exists "Admins read reviews" on public.reviews;
drop policy if exists "Users create own reviews" on public.reviews;
create policy "Users create own reviews" on public.reviews for insert to authenticated with check (
 user_id=(select auth.uid()) and username=(select p.username from public.profiles p where p.id=(select auth.uid()))
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.admin_credentials (
 singleton boolean primary key default true check (singleton),
 password_hash text not null
);
revoke all on table private.admin_credentials from public, anon, authenticated;

create table if not exists private.site_visits (
 session_id uuid not null,
 page_path text not null check (page_path in ('/','/index.html','/game.html','/puzzles.html','/openings.html','/lesson.html')),
 visited_on date not null default (timezone('utc',now())::date),
 created_at timestamptz not null default now(),
 primary key (session_id,page_path,visited_on)
);
revoke all on table private.site_visits from public, anon, authenticated;
create index if not exists site_visits_visited_on_idx on private.site_visits(visited_on);

create or replace function public.record_site_visit(p_session_id uuid,p_page_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
 if p_session_id is null then raise exception 'Invalid visit session'; end if;
 if p_page_path is null then return; end if;
 if p_page_path not in ('/','/index.html','/game.html','/puzzles.html','/openings.html','/lesson.html') then return; end if;
 insert into private.site_visits(session_id,page_path)
 values (p_session_id,p_page_path)
 on conflict do nothing;
end;
$$;
revoke all on function public.record_site_visit(uuid,text) from public;
grant execute on function public.record_site_visit(uuid,text) to anon,authenticated;

insert into private.admin_credentials(singleton,password_hash)
values (true, extensions.crypt('YOUR_MASTER_PASSWORD', extensions.gen_salt('bf', 12)))
on conflict (singleton) do update set password_hash=excluded.password_hash;

create or replace function public.admin_dashboard(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 stored_hash text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select password_hash into stored_hash from private.admin_credentials where singleton=true;
 if stored_hash is null or extensions.crypt(coalesce(p_password,''),stored_hash) is distinct from stored_hash then
  raise exception 'Invalid master password';
 end if;
 return jsonb_build_object(
  'users',coalesce((
   select jsonb_agg(jsonb_build_object(
    'username',p.username,'email',p.email,'created_at',p.created_at,
    'games_played',p.games_played,'wins',p.wins,'losses',p.losses,
    'puzzles_solved',p.puzzles_solved,'xp',p.xp
   ) order by p.created_at desc) from public.profiles p
  ),'[]'::jsonb),
  'reviews',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',r.id,'user_id',r.user_id,'username',r.username,
    'message',r.message,'created_at',r.created_at
   ) order by r.created_at desc) from public.reviews r
  ),'[]'::jsonb),
  'analytics',jsonb_build_object(
   'totals',jsonb_build_object(
    'total_visits',(select count(*) from private.site_visits),
    'today_visits',(select count(*) from private.site_visits where visited_on=timezone('utc',now())::date),
    'visits_30_days',(select count(*) from private.site_visits where visited_on>=timezone('utc',now())::date-29),
    'visitors_30_days',(select count(distinct session_id) from private.site_visits where visited_on>=timezone('utc',now())::date-29)
   ),
   'daily',coalesce((
    select jsonb_agg(jsonb_build_object('date',days.day::date,'views',daily.views,'sessions',daily.sessions) order by days.day)
    from generate_series(timezone('utc',now())::date-29,timezone('utc',now())::date,interval '1 day') as days(day)
    left join lateral (
     select count(*) as views,count(distinct session_id) as sessions
     from private.site_visits where visited_on=days.day::date
    ) daily on true
   ),'[]'::jsonb),
   'pages',coalesce((
    select jsonb_agg(jsonb_build_object('page_path',page_path,'views',views,'sessions',sessions) order by views desc)
    from (
     select page_path,count(*) as views,count(distinct session_id) as sessions
     from private.site_visits where visited_on>=timezone('utc',now())::date-29
     group by page_path
    ) page_totals
   ),'[]'::jsonb)
  )
 );
end;
$$;
revoke all on function public.admin_dashboard(text) from public, anon;
grant execute on function public.admin_dashboard(text) to authenticated;
