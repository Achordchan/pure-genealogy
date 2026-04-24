create extension if not exists pgcrypto;

create table if not exists app_users (
    id uuid primary key default gen_random_uuid(),
    username text not null unique,
    password_hash text not null,
    real_name text not null,
    phone text,
    status text not null default 'active' check (status in ('active', 'disabled')),
    role text not null default 'member' check (role in ('admin', 'editor', 'member')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_status_role
    on app_users(status, role);

create table if not exists family_members (
    id bigint generated always as identity primary key,
    name text not null,
    generation integer,
    sibling_order integer,
    father_id bigint references family_members(id),
    gender text check (gender in ('男', '女')),
    official_position text,
    is_alive boolean not null default true,
    spouse text,
    remarks text,
    birthday date,
    death_date date,
    residence_place text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_family_members_father_id
    on family_members(father_id);

create index if not exists idx_family_members_name
    on family_members(name);

create table if not exists account_profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references app_users(id) on delete cascade,
    legacy_auth_user_id uuid unique,
    real_name text not null,
    real_name_normalized text not null,
    id_card_value text,
    id_card_hash text not null unique,
    id_card_masked text not null,
    phone text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    role text not null default 'member' check (role in ('admin', 'editor', 'member')),
    member_id bigint unique references family_members(id),
    approved_at timestamptz,
    approved_by uuid references app_users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_account_profiles_user_id
    on account_profiles(user_id);

create index if not exists idx_account_profiles_legacy_auth_user_id
    on account_profiles(legacy_auth_user_id)
    where legacy_auth_user_id is not null;


create index if not exists idx_account_profiles_status_created_at
    on account_profiles(status, created_at);

create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references app_users(id) on delete cascade,
    token_hash text not null unique,
    user_agent text,
    ip_address inet,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user_id_created_at
    on sessions(user_id, created_at desc);

create index if not exists idx_sessions_expires_at
    on sessions(expires_at);

create table if not exists member_change_requests (
    id uuid primary key default gen_random_uuid(),
    account_profile_id uuid not null references account_profiles(id) on delete cascade,
    member_id bigint not null references family_members(id) on delete cascade,
    payload jsonb not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    review_comment text,
    reviewed_by uuid references app_users(id),
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_member_change_requests_account_status
    on member_change_requests(account_profile_id, status);

create index if not exists idx_member_change_requests_member_status
    on member_change_requests(member_id, status);

create table if not exists member_rituals (
    id uuid primary key default gen_random_uuid(),
    member_id bigint not null unique references family_members(id) on delete cascade,
    cemetery_name text not null,
    area_block text,
    plot_number text,
    address text not null,
    province text,
    city text,
    district text,
    latitude double precision,
    longitude double precision,
    contact_name text,
    contact_phone text,
    guide_text text,
    ritual_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_member_rituals_member_id
    on member_rituals(member_id);

create table if not exists member_assets (
    id uuid primary key default gen_random_uuid(),
    member_id bigint not null references family_members(id) on delete cascade,
    bucket text not null,
    asset_scope text not null default 'profile' check (asset_scope in ('profile', 'ritual')),
    object_path text not null unique,
    file_name text not null,
    mime_type text not null,
    file_size bigint not null,
    uploaded_by uuid not null references app_users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create index if not exists idx_member_assets_member_created_at
    on member_assets(member_id, created_at desc);

create index if not exists idx_member_assets_member_scope_created_at
    on member_assets(member_id, asset_scope, created_at desc);

create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_user_id uuid references app_users(id) on delete set null,
    action text not null,
    target_type text,
    target_id text,
    detail jsonb not null default '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor_created_at
    on audit_logs(actor_user_id, created_at desc);

create index if not exists idx_audit_logs_action_created_at
    on audit_logs(action, created_at desc);
