create extension if not exists pgcrypto;

create table if not exists account_profiles (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    real_name text not null,
    real_name_normalized text not null,
    id_card_hash text not null unique,
    id_card_masked text not null,
    phone text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    is_admin boolean not null default false,
    approved_at timestamptz,
    approved_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_account_profiles_auth_user_id
    on account_profiles(auth_user_id);

create index if not exists idx_account_profiles_status_created_at
    on account_profiles(status, created_at);

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
