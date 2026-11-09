-- Additive production migration. Does not alter existing answer or completion records.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from public, anon, authenticated;

-- The administrator is the one preexisting production account. No new user is an administrator.
insert into public.app_admins(user_id)
select id from auth.users
where id='1e51e804-2bd1-4142-8c62-7e7fe381c10f'
on conflict(user_id) do nothing;

-- Existing allowed_sync_users RLS and user-separated answer/set policies remain intact.
create or replace function public.approve_new_sync_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.allowed_sync_users(user_id) values (new.id)
  on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.approve_new_sync_user() from public, anon, authenticated;
drop trigger if exists approve_new_sync_user_trigger on auth.users;
create trigger approve_new_sync_user_trigger
after insert on auth.users for each row execute function public.approve_new_sync_user();

-- Admin-only metrics: signed-in non-admin calls fail with SQLSTATE 42501.
create or replace function public.admin_sync_overview()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare output jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.app_admins where user_id=(select auth.uid())
  ) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  select jsonb_build_object(
    'registered',(select count(*) from auth.users),
    'approved',(select count(*) from public.allowed_sync_users),
    'ever_synced',(select count(*) from (
      select user_id from public.answer_events
      union select user_id from public.set_completion_events
    ) synced),
    'active_7d',(select count(*) from (
      select user_id from public.answer_events where created_at>=now()-interval '7 days'
      union select user_id from public.set_completion_events where created_at>=now()-interval '7 days'
    ) active),
    'active_30d',(select count(*) from (
      select user_id from public.answer_events where created_at>=now()-interval '30 days'
      union select user_id from public.set_completion_events where created_at>=now()-interval '30 days'
    ) active),
    'answers',(select count(*) from public.answer_events),
    'sets',(select count(*) from public.set_completion_events),
    'updated_at',now()
  ) into output;
  return output;
end;
$$;
revoke all on function public.admin_sync_overview() from public, anon;
grant execute on function public.admin_sync_overview() to authenticated;