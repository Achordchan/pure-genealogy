create extension if not exists pgcrypto;

create table if not exists family_members (
    id bigint generated always as identity primary key,
    name text not null,
    generation integer,
    sibling_order integer,
    father_id bigint references family_members(id),
    gender text check (gender in ('男', '女')),
    official_position text,
    is_alive boolean default true,
    spouse text,
    remarks text,
    birthday date,
    death_date date,
    residence_place text,
    updated_at timestamptz not null default now()
);

create index if not exists idx_family_members_father_id
    on family_members(father_id);

create index if not exists idx_family_members_name
    on family_members(name);

create table if not exists account_profiles (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    real_name text not null,
    real_name_normalized text not null,
    id_card_hash text not null unique,
    id_card_masked text not null,
    phone text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    role text not null default 'member' check (role in ('admin', 'editor', 'member')),
    member_id bigint unique references family_members(id),
    approved_at timestamptz,
    approved_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_account_profiles_auth_user_id
    on account_profiles(auth_user_id);

create index if not exists idx_account_profiles_status_created_at
    on account_profiles(status, created_at);

create table if not exists member_change_requests (
    id uuid primary key default gen_random_uuid(),
    account_profile_id uuid not null references account_profiles(id) on delete cascade,
    member_id bigint not null references family_members(id) on delete cascade,
    payload jsonb not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    review_comment text,
    reviewed_by uuid references auth.users(id),
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_member_change_requests_account_status
    on member_change_requests(account_profile_id, status);

create index if not exists idx_member_change_requests_member_status
    on member_change_requests(member_id, status);

create or replace function public.app_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.account_profiles
      where auth_user_id = auth.uid()
      limit 1
    ),
    'anonymous'
  );
$$;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_current_role() = 'admin';
$$;

create or replace function public.app_is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_current_role() = 'editor';
$$;

create or replace function public.app_bound_member_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select member_id
  from public.account_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.guard_account_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_is_admin() then
    return new;
  end if;

  if auth.uid() is distinct from old.auth_user_id then
    raise exception '无权更新该账号';
  end if;

  if new.auth_user_id is distinct from old.auth_user_id
     or new.real_name is distinct from old.real_name
     or new.real_name_normalized is distinct from old.real_name_normalized
     or new.id_card_hash is distinct from old.id_card_hash
     or new.id_card_masked is distinct from old.id_card_masked
     or new.status is distinct from old.status
     or new.role is distinct from old.role
     or new.member_id is distinct from old.member_id
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by
     or new.created_at is distinct from old.created_at then
    raise exception '普通账号只能更新手机号';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_account_profile_self_update on public.account_profiles;

create trigger trg_guard_account_profile_self_update
before update on public.account_profiles
for each row
execute function public.guard_account_profile_self_update();

alter table public.account_profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.member_change_requests enable row level security;

drop policy if exists account_profiles_select_self on public.account_profiles;
create policy account_profiles_select_self
on public.account_profiles
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists account_profiles_select_admin on public.account_profiles;
create policy account_profiles_select_admin
on public.account_profiles
for select
to authenticated
using (public.app_is_admin());

drop policy if exists account_profiles_insert_self on public.account_profiles;
create policy account_profiles_insert_self
on public.account_profiles
for insert
to authenticated
with check (auth.uid() = auth_user_id);

drop policy if exists account_profiles_update_self on public.account_profiles;
create policy account_profiles_update_self
on public.account_profiles
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists account_profiles_update_admin on public.account_profiles;
create policy account_profiles_update_admin
on public.account_profiles
for update
to authenticated
using (public.app_is_admin())
with check (public.app_is_admin());

drop policy if exists family_members_select_approved on public.family_members;
create policy family_members_select_approved
on public.family_members
for select
to authenticated
using (
  exists (
    select 1
    from public.account_profiles ap
    where ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
  )
);

drop policy if exists family_members_insert_editor_admin on public.family_members;
create policy family_members_insert_editor_admin
on public.family_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.account_profiles ap
    where ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role in ('admin', 'editor')
  )
);

drop policy if exists family_members_update_editor_admin on public.family_members;
create policy family_members_update_editor_admin
on public.family_members
for update
to authenticated
using (
  exists (
    select 1
    from public.account_profiles ap
    where ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.account_profiles ap
    where ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role in ('admin', 'editor')
  )
);

drop policy if exists family_members_delete_admin on public.family_members;
create policy family_members_delete_admin
on public.family_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.account_profiles ap
    where ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role = 'admin'
  )
);

drop policy if exists member_change_requests_select_self on public.member_change_requests;
create policy member_change_requests_select_self
on public.member_change_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.account_profiles ap
    where ap.id = account_profile_id
      and ap.auth_user_id = auth.uid()
  )
);

drop policy if exists member_change_requests_select_reviewer on public.member_change_requests;
create policy member_change_requests_select_reviewer
on public.member_change_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.account_profiles ap
    where ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role in ('admin', 'editor')
  )
);

drop policy if exists member_change_requests_insert_self on public.member_change_requests;
create policy member_change_requests_insert_self
on public.member_change_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.account_profiles ap
    where ap.id = account_profile_id
      and ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role = 'member'
      and ap.member_id = member_change_requests.member_id
  )
);

drop policy if exists member_change_requests_update_self_pending on public.member_change_requests;
create policy member_change_requests_update_self_pending
on public.member_change_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.account_profiles ap
    where ap.id = account_profile_id
      and ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role = 'member'
      and member_change_requests.status = 'pending'
  )
)
with check (
  exists (
    select 1
    from public.account_profiles ap
    where ap.id = account_profile_id
      and ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role = 'member'
      and ap.member_id = member_change_requests.member_id
      and member_change_requests.status = 'pending'
  )
);

drop policy if exists member_change_requests_update_reviewer on public.member_change_requests;
create policy member_change_requests_update_reviewer
on public.member_change_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.account_profiles ap
    where ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.account_profiles ap
    where ap.auth_user_id = auth.uid()
      and ap.status = 'approved'
      and ap.role in ('admin', 'editor')
  )
);
