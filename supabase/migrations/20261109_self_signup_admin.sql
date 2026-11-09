-- Review and apply to the connected Supabase project only after staging verification.
-- Existing history, permissions and user accounts are not deleted or modified.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;
-- Administrator is the existing project owner account, not any newly registered user.
insert into public.app_admins(user_id)
values ('1e51e804-2bd1-4142-8c62-7e7fe381c10f')
on conflict (user_id) do nothing;

-- A confirmed email/password account can sync without manual administrator approval.
-- Preserve the existing allow-list and user-specific answer/set RLS policies.
create or replace function public.approve_new_sync_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.allowed_sync_users(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.approve_new_sync_user() from public, anon, authenticated;
drop trigger if exists approve_new_sync_user_trigger on auth.users;
create trigger approve_new_sync_user_trigger
after insert on auth.users for each row execute function public.approve_new_sync_user();

-- Counts are computed by the database; no service-role key is exposed to browsers.
create or replace function public.admin_sync_overview()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare output jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.app_admins where user_id = (select auth.uid())
  ) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'registered', (select count(*) from auth.users),
    'approved', (select count(*) from public.allowed_sync_users),
    'ever_synced', (select count(*) from (
      select user_id from public.answer_events
      union
      select user_id from public.set_completion_events
    ) synced),
    'active_7d', (select count(distinct user_id) from (
      select user_id from public.answer_events where created_at >= now()-interval '7 days'
      union all
      select user_id from public.set_completion_events where created_at >= now()-interval '7 days'
    ) active),
    'active_30d', (select count(distinct user_id) from (
      select user_id from public.answer_events where created_at >= now()-interval '30 days'
      union all
      select user_id from public.set_completion_events where created_at >= now()-interval '30 days'
    ) active),
    'answers', (select count(*) from public.answer_events),
    'sets', (select count(*) from public.set_completion_events),
    'updated_at', now()
  ) into output;
  return output;
end;
$$;
revoke all on function public.admin_sync_overview() from public, anon;
grant execute on function public.admin_sync_overview() to authenticated;
