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

create table if not exists member_assets (
    id uuid primary key default gen_random_uuid(),
    member_id bigint not null references family_members(id) on delete cascade,
    bucket text not null,
    object_path text not null unique,
    file_name text not null,
    mime_type text not null,
    file_size bigint not null,
    uploaded_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create index if not exists idx_member_assets_member_created_at
    on member_assets(member_id, created_at desc);

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

create or replace function public.app_current_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select status
      from public.account_profiles
      where auth_user_id = auth.uid()
      limit 1
    ),
    'anonymous'
  );
$$;

create or replace function public.app_is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_current_status() = 'approved';
$$;

create or replace function public.app_can_manage_family_members()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_is_approved() and public.app_current_role() in ('admin', 'editor');
$$;

create or replace function public.app_can_review_member_changes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_is_approved() and public.app_current_role() in ('admin', 'editor');
$$;

create or replace function public.app_can_manage_accounts()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_is_approved() and public.app_current_role() = 'admin';
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
alter table public.member_assets enable row level security;

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

drop policy if exists member_assets_select_approved on public.member_assets;
create policy member_assets_select_approved
on public.member_assets
for select
to authenticated
using (public.app_is_approved());

drop policy if exists member_assets_insert_editor_admin on public.member_assets;
create policy member_assets_insert_editor_admin
on public.member_assets
for insert
to authenticated
with check (public.app_can_manage_family_members() and uploaded_by = auth.uid());

drop policy if exists member_assets_update_editor_admin on public.member_assets;
create policy member_assets_update_editor_admin
on public.member_assets
for update
to authenticated
using (public.app_can_manage_family_members())
with check (public.app_can_manage_family_members());

drop policy if exists member_assets_delete_editor_admin on public.member_assets;
create policy member_assets_delete_editor_admin
on public.member_assets
for delete
to authenticated
using (public.app_can_manage_family_members());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'member-assets',
    'member-assets',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'genealogy-archives',
    'genealogy-archives',
    false,
    26214400,
    array[
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();

drop policy if exists storage_member_assets_select_approved on storage.objects;
create policy storage_member_assets_select_approved
on storage.objects
for select
to authenticated
using (
  bucket_id = 'member-assets'
  and public.app_is_approved()
);

drop policy if exists storage_member_assets_insert_editor_admin on storage.objects;
create policy storage_member_assets_insert_editor_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-assets'
  and public.app_can_manage_family_members()
);

drop policy if exists storage_member_assets_update_editor_admin on storage.objects;
create policy storage_member_assets_update_editor_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-assets'
  and public.app_can_manage_family_members()
)
with check (
  bucket_id = 'member-assets'
  and public.app_can_manage_family_members()
);

drop policy if exists storage_member_assets_delete_editor_admin on storage.objects;
create policy storage_member_assets_delete_editor_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-assets'
  and public.app_can_manage_family_members()
);

drop policy if exists storage_genealogy_archives_select_admin on storage.objects;
create policy storage_genealogy_archives_select_admin
on storage.objects
for select
to authenticated
using (
  bucket_id = 'genealogy-archives'
  and public.app_can_manage_accounts()
);

drop policy if exists storage_genealogy_archives_insert_admin on storage.objects;
create policy storage_genealogy_archives_insert_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'genealogy-archives'
  and public.app_can_manage_accounts()
);

drop policy if exists storage_genealogy_archives_update_admin on storage.objects;
create policy storage_genealogy_archives_update_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'genealogy-archives'
  and public.app_can_manage_accounts()
)
with check (
  bucket_id = 'genealogy-archives'
  and public.app_can_manage_accounts()
);

drop policy if exists storage_genealogy_archives_delete_admin on storage.objects;
create policy storage_genealogy_archives_delete_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'genealogy-archives'
  and public.app_can_manage_accounts()
);

create or replace function public.app_get_backoffice_notice_counts()
returns table (
  pending_accounts bigint,
  pending_member_changes bigint,
  total bigint
)
language plpgsql
set search_path = public
as $$
declare
  account_count bigint := 0;
  draft_count bigint := 0;
begin
  if public.app_can_manage_accounts() then
    select count(*) into account_count
    from public.account_profiles
    where status = 'pending';
  end if;

  if public.app_can_review_member_changes() then
    select count(*) into draft_count
    from public.member_change_requests
    where status = 'pending';
  end if;

  return query
  select account_count, draft_count, account_count + draft_count;
end;
$$;

create or replace function public.app_approve_account(
  target_profile_id uuid,
  target_member_id bigint,
  target_role text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  profile_record public.account_profiles%rowtype;
begin
  if not public.app_can_manage_accounts() then
    raise exception '仅管理员可以审核账号';
  end if;

  if target_role not in ('member', 'editor') then
    raise exception '待审核账号只能批准为普通用户或编辑员';
  end if;

  if target_member_id is null then
    raise exception '批准账号前必须绑定成员';
  end if;

  select *
  into profile_record
  from public.account_profiles
  where id = target_profile_id
  for update;

  if not found then
    raise exception '未找到待审核账号';
  end if;

  if profile_record.status <> 'pending' then
    raise exception '当前账号不处于待审核状态';
  end if;

  if not exists (
    select 1
    from public.family_members
    where id = target_member_id
  ) then
    raise exception '绑定成员不存在';
  end if;

  if exists (
    select 1
    from public.account_profiles
    where member_id = target_member_id
      and id <> target_profile_id
  ) then
    raise exception '该族谱成员已绑定其他账号';
  end if;

  update public.account_profiles
  set status = 'approved',
      role = target_role,
      member_id = target_member_id,
      approved_at = now(),
      approved_by = auth.uid(),
      updated_at = now()
  where id = target_profile_id;
end;
$$;

create or replace function public.app_reject_account(
  target_profile_id uuid,
  review_comment text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  profile_record public.account_profiles%rowtype;
begin
  if not public.app_can_manage_accounts() then
    raise exception '仅管理员可以审核账号';
  end if;

  select *
  into profile_record
  from public.account_profiles
  where id = target_profile_id
  for update;

  if not found then
    raise exception '未找到待审核账号';
  end if;

  if profile_record.status <> 'pending' then
    raise exception '当前账号不处于待审核状态';
  end if;

  perform nullif(trim(review_comment), '');

  update public.account_profiles
  set status = 'rejected',
      role = 'member',
      member_id = null,
      approved_at = null,
      approved_by = null,
      updated_at = now()
  where id = target_profile_id;
end;
$$;

create or replace function public.app_approve_member_change_request(
  target_request_id uuid,
  review_comment text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  request_record public.member_change_requests%rowtype;
begin
  if not public.app_can_review_member_changes() then
    raise exception '当前账号无权审核资料草稿';
  end if;

  select *
  into request_record
  from public.member_change_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception '未找到待审核草稿';
  end if;

  if request_record.status <> 'pending' then
    raise exception '当前草稿不处于待审核状态';
  end if;

  update public.family_members
  set spouse = case
        when request_record.payload ? 'spouse'
          then nullif(request_record.payload->>'spouse', '')
        else spouse
      end,
      birthday = case
        when request_record.payload ? 'birthday'
          then nullif(request_record.payload->>'birthday', '')::date
        else birthday
      end,
      death_date = case
        when request_record.payload ? 'death_date'
          then nullif(request_record.payload->>'death_date', '')::date
        else death_date
      end,
      residence_place = case
        when request_record.payload ? 'residence_place'
          then nullif(request_record.payload->>'residence_place', '')
        else residence_place
      end,
      official_position = case
        when request_record.payload ? 'official_position'
          then nullif(request_record.payload->>'official_position', '')
        else official_position
      end,
      remarks = case
        when request_record.payload ? 'remarks'
          then nullif(request_record.payload->>'remarks', '')
        else remarks
      end,
      updated_at = now()
  where id = request_record.member_id;

  update public.member_change_requests
  set status = 'approved',
      review_comment = nullif(trim(review_comment), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = target_request_id;
end;
$$;

create or replace function public.app_reject_member_change_request(
  target_request_id uuid,
  review_comment text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  request_record public.member_change_requests%rowtype;
begin
  if not public.app_can_review_member_changes() then
    raise exception '当前账号无权审核资料草稿';
  end if;

  select *
  into request_record
  from public.member_change_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception '未找到待审核草稿';
  end if;

  if request_record.status <> 'pending' then
    raise exception '当前草稿不处于待审核状态';
  end if;

  update public.member_change_requests
  set status = 'rejected',
      review_comment = nullif(trim(review_comment), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = target_request_id;
end;
$$;

revoke execute on function public.app_get_backoffice_notice_counts() from public, anon;
grant execute on function public.app_get_backoffice_notice_counts() to authenticated;

revoke execute on function public.app_approve_account(uuid, bigint, text) from public, anon;
grant execute on function public.app_approve_account(uuid, bigint, text) to authenticated;

revoke execute on function public.app_reject_account(uuid, text) from public, anon;
grant execute on function public.app_reject_account(uuid, text) to authenticated;

revoke execute on function public.app_approve_member_change_request(uuid, text) from public, anon;
grant execute on function public.app_approve_member_change_request(uuid, text) to authenticated;

revoke execute on function public.app_reject_member_change_request(uuid, text) from public, anon;
grant execute on function public.app_reject_member_change_request(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'account_profiles'
  ) then
    alter publication supabase_realtime add table public.account_profiles;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'member_change_requests'
  ) then
    alter publication supabase_realtime add table public.member_change_requests;
  end if;
end
$$;
