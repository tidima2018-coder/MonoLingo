-- Run once in Supabase SQL Editor for an existing project.
alter table public.profiles add column if not exists draws integer not null default 0 check (draws >= 0);

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

revoke all on function public.record_game_started() from public, anon;
grant execute on function public.record_game_started() to authenticated;
revoke all on function public.record_game_result(text) from public, anon;
grant execute on function public.record_game_result(text) to authenticated;