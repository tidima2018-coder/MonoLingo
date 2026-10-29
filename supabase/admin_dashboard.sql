-- Apply after schema.sql in the Supabase SQL Editor.
-- This migration removes the shared master password and uses per-user roles.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','admin','super_admin'));
alter table public.profiles alter column role set default 'user';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
drop table if exists private.admin_credentials;
create table if not exists private.site_visits (
 session_id uuid not null,
 page_path text not null check (page_path in ('/','/index.html','/game.html','/puzzles.html','/openings.html','/lesson.html')),
 visited_on date not null default (timezone('utc',now())::date),
 created_at timestamptz not null default now(),
 primary key (session_id,page_path,visited_on)
);
revoke all on table private.site_visits from public, anon, authenticated;
create index if not exists site_visits_visited_on_idx on private.site_visits(visited_on);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','super_admin'));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Profile rows are visible only to their owner through PostgREST. Role edits are only possible
-- through set_admin_role(), which checks super_admin from the database on every call.
drop policy if exists "Users read own profile and admins read all" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id=(select auth.uid()));
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant insert (id,username,email) on table public.profiles to authenticated;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id=(select auth.uid()) and role='user');

create or replace function public.record_site_visit(p_session_id uuid,p_page_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_session_id is null then raise exception 'Invalid visit session'; end if;
 if p_page_path not in ('/','/index.html','/game.html','/puzzles.html','/openings.html','/lesson.html') then return; end if;
 insert into private.site_visits(session_id,page_path) values(p_session_id,p_page_path) on conflict do nothing;
end;
$$;
revoke all on function public.record_site_visit(uuid,text) from public;
grant execute on function public.record_site_visit(uuid,text) to anon,authenticated;

drop function if exists public.admin_dashboard(text);
create or replace function public.admin_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
 return jsonb_build_object(
  'users',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'email',p.email,'role',p.role,'created_at',p.created_at,'games_played',p.games_played,'wins',p.wins,'losses',p.losses,'puzzles_solved',p.puzzles_solved,'xp',p.xp) order by p.created_at desc) from public.profiles p),'[]'::jsonb),
  'reviews',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'username',r.username,'message',r.message,'created_at',r.created_at) order by r.created_at desc) from public.reviews r),'[]'::jsonb),
  'analytics',jsonb_build_object(
   'totals',jsonb_build_object('total_visits',(select count(*) from private.site_visits),'today_visits',(select count(*) from private.site_visits where visited_on=timezone('utc',now())::date),'visits_30_days',(select count(*) from private.site_visits where visited_on>=timezone('utc',now())::date-29),'visitors_30_days',(select count(distinct session_id) from private.site_visits where visited_on>=timezone('utc',now())::date-29)),
   'daily',coalesce((select jsonb_agg(jsonb_build_object('date',days.day::date,'views',daily.views,'sessions',daily.sessions) order by days.day) from generate_series(timezone('utc',now())::date-29,timezone('utc',now())::date,interval '1 day') as days(day) left join lateral (select count(*) as views,count(distinct session_id) as sessions from private.site_visits where visited_on=days.day::date) daily on true),'[]'::jsonb),
   'pages',coalesce((select jsonb_agg(jsonb_build_object('page_path',page_path,'views',views,'sessions',sessions) order by views desc) from (select page_path,count(*) as views,count(distinct session_id) as sessions from private.site_visits where visited_on>=timezone('utc',now())::date-29 group by page_path) page_totals),'[]'::jsonb)
  )
 );
end;
$$;
revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

create or replace function public.set_admin_role(p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='super_admin') then raise exception 'Super admin access required'; end if;
 if p_user_id is null or p_role is null or p_role not in ('admin','user') then raise exception 'Invalid role change'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'User profile not found'; end if;
 if exists(select 1 from public.profiles where id=p_user_id and role='super_admin') then raise exception 'Cannot change super admin role'; end if;
 update public.profiles set role=p_role where id=p_user_id;
end;
$$;
revoke all on function public.set_admin_role(uuid,text) from public, anon;
grant execute on function public.set_admin_role(uuid,text) to authenticated;

-- Assign the first super_admin manually after creating and confirming your account:
-- update public.profiles set role='super_admin' where email=lower('YOUR_EMAIL');
-- Run that statement only once for your own verified account. Never expose service_role keys.
