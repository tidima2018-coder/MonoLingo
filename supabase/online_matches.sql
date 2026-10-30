-- MonoLingo online chess, additive migration. Apply manually in Supabase SQL Editor.
-- Does not alter profiles, statistics, friends, roles, or existing game tables.
begin;

create table if not exists public.online_invites (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users(id) on delete cascade,
  recipient uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  settings jsonb not null default '{}'::jsonb,
  match_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender <> recipient)
);
create index if not exists online_invites_recipient_pending on public.online_invites(recipient, created_at desc) where status='pending';
create index if not exists online_invites_sender_pending on public.online_invites(sender, created_at desc) where status='pending';
create unique index if not exists online_invites_pair_pending on public.online_invites(least(sender,recipient), greatest(sender,recipient)) where status='pending';

create table if not exists public.online_matches (
  id uuid primary key default gen_random_uuid(),
  white_player uuid not null references auth.users(id) on delete cascade,
  black_player uuid not null references auth.users(id) on delete cascade,
  white_username text not null,
  black_username text not null,
  mode text not null default 'classic',
  settings jsonb not null default '{}'::jsonb,
  initial_fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves jsonb not null default '[]'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  status text not null default 'active' check (status in ('active','completed')),
  result text check (result in ('white_win','black_win','draw')),
  termination text,
  white_time_ms bigint,
  black_time_ms bigint,
  clock_started_at timestamptz,
  draw_offered_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (white_player <> black_player)
);
alter table public.online_invites drop constraint if exists online_invites_match_id_fkey;
alter table public.online_invites add constraint online_invites_match_id_fkey foreign key (match_id) references public.online_matches(id) on delete set null;
create index if not exists online_matches_white_recent on public.online_matches(white_player, updated_at desc);
create index if not exists online_matches_black_recent on public.online_matches(black_player, updated_at desc);

alter table public.online_invites enable row level security;
alter table public.online_matches enable row level security;
revoke all on public.online_invites, public.online_matches from anon, authenticated;
grant select on public.online_invites, public.online_matches to authenticated;
drop policy if exists online_invites_participants_read on public.online_invites;
create policy online_invites_participants_read on public.online_invites for select to authenticated using ((select auth.uid()) in (sender, recipient));
drop policy if exists online_matches_participants_read on public.online_matches;
create policy online_matches_participants_read on public.online_matches for select to authenticated using ((select auth.uid()) in (white_player, black_player));

create or replace function public.create_online_invite(p_target uuid, p_settings jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_sender uuid := auth.uid();
begin
  if v_sender is null then raise exception 'Authentication required'; end if;
  if p_target is null or p_target = v_sender then raise exception 'Invalid opponent'; end if;
  if not exists (select 1 from public.friendships f where f.status='accepted' and ((f.requester=v_sender and f.recipient=p_target) or (f.recipient=v_sender and f.requester=p_target))) then raise exception 'Opponent is not your friend'; end if;
  if exists (select 1 from public.online_invites i where i.status='pending' and ((i.sender=v_sender and i.recipient=p_target) or (i.sender=p_target and i.recipient=v_sender))) then raise exception 'A pending invitation already exists'; end if;
  if jsonb_typeof(coalesce(p_settings,'{}'::jsonb)) <> 'object' then raise exception 'Invalid settings'; end if;
  if coalesce(p_settings->>'mode','classic') <> 'classic' then raise exception 'Unsupported chess mode'; end if;
  if coalesce(p_settings->>'color','random') not in ('white','black','random') then raise exception 'Invalid color selection'; end if;
  if coalesce(p_settings->>'seconds','0') !~ '^[0-9]{1,5}$' then raise exception 'Invalid clock setting'; end if;
  if coalesce((p_settings->>'seconds')::integer,0) not between 0 and 10800 then raise exception 'Invalid clock setting'; end if;
  insert into public.online_invites(sender,recipient,settings) values(v_sender,p_target,coalesce(p_settings,'{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_online_invite(p_invite uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.online_invites%rowtype; v_match uuid; v_white uuid; v_black uuid; v_seconds integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_inv from public.online_invites where id=p_invite and recipient=auth.uid() and status='pending' for update;
  if not found then raise exception 'Invitation unavailable'; end if;
  if not p_accept then update public.online_invites set status='rejected',updated_at=now() where id=p_invite; return null; end if;
  if not exists (select 1 from public.friendships f where f.status='accepted' and ((f.requester=v_inv.sender and f.recipient=v_inv.recipient) or (f.recipient=v_inv.sender and f.requester=v_inv.recipient))) then raise exception 'Opponent is no longer your friend'; end if;
  if coalesce(v_inv.settings->>'color','random')='white' then v_white:=v_inv.sender; v_black:=v_inv.recipient;
  elsif coalesce(v_inv.settings->>'color','random')='black' then v_white:=v_inv.recipient; v_black:=v_inv.sender;
  elsif random()<0.5 then v_white:=v_inv.sender; v_black:=v_inv.recipient;
  else v_white:=v_inv.recipient; v_black:=v_inv.sender; end if;
  v_seconds:=greatest(0,least(10800,coalesce((v_inv.settings->>'seconds')::integer,0)));
  insert into public.online_matches(white_player,black_player,white_username,black_username,mode,settings,white_time_ms,black_time_ms,clock_started_at)
  values(v_white,v_black,
    (select username from public.friend_directory where user_id=v_white),
    (select username from public.friend_directory where user_id=v_black),
    coalesce(v_inv.settings->>'mode','classic'),v_inv.settings,
    case when v_seconds=0 then null else v_seconds*1000::bigint end,
    case when v_seconds=0 then null else v_seconds*1000::bigint end, now()) returning id into v_match;
  update public.online_invites set status='accepted',match_id=v_match,updated_at=now() where id=p_invite;
  return v_match;
end $$;

create or replace function public.list_online_invites()
returns table(invite_id uuid, sender_id uuid, sender_name text, recipient_id uuid, recipient_name text, status text, settings jsonb, match_id uuid, created_at timestamptz, match_status text)
language sql stable security definer set search_path = '' as $$
 select i.id,i.sender,sd.username,i.recipient,rd.username,i.status,i.settings,i.match_id,i.created_at,m.status
 from public.online_invites i
 left join public.friend_directory sd on sd.user_id=i.sender
 left join public.friend_directory rd on rd.user_id=i.recipient
 left join public.online_matches m on m.id=i.match_id
 where auth.uid() in (i.sender,i.recipient) and i.status in ('pending','accepted')
 order by i.created_at desc;
$$;

create or replace function public.list_my_online_matches()
returns setof public.online_matches language sql stable security definer set search_path = '' as $$
 select m.* from public.online_matches m where auth.uid() in (m.white_player,m.black_player) order by m.created_at desc limit 100;
$$;

revoke all on function public.create_online_invite(uuid,jsonb), public.respond_online_invite(uuid,boolean), public.list_online_invites(), public.list_my_online_matches() from public, anon;
grant execute on function public.create_online_invite(uuid,jsonb), public.respond_online_invite(uuid,boolean), public.list_online_invites(), public.list_my_online_matches() to authenticated;

-- Realtime updates are participant-readable; browsers cannot write match state.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='online_matches') then alter publication supabase_realtime add table public.online_matches; end if;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='online_invites') then alter publication supabase_realtime add table public.online_invites; end if;
end $$;
notify pgrst, 'reload schema';
commit;
