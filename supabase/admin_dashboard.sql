-- Run in Supabase SQL Editor after replacing YOUR_MASTER_PASSWORD below.
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
  ),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.admin_dashboard(text) from public, anon;
grant execute on function public.admin_dashboard(text) to authenticated;