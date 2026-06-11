-- ============================================================
-- genny — gated investor area schema
-- Run once in the Supabase SQL Editor (or `supabase db push`).
-- All access goes through Edge Functions using the service role;
-- RLS is enabled with NO policies so anon/authenticated are denied.
-- ============================================================

create table if not exists public.requests (
  id          uuid primary key default gen_random_uuid(),
  type        text not null default 'request' check (type in ('request','reset')),
  name        text not null default '',
  email       text not null,
  firm        text not null default '',
  note        text not null default '',
  status      text not null default 'new' check (status in ('new','granted','dismissed')),
  known_investor boolean not null default false,
  created_at  timestamptz not null default now(),
  handled_at  timestamptz
);

create table if not exists public.investors (
  email       text primary key,            -- normalized lowercase
  name        text not null default '',
  firm        text not null default '',
  code        text not null,               -- plaintext by design: Natasha re-drafts code emails
  status      text not null default 'active' check (status in ('active','revoked')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  request_id  uuid,
  agreed_at   timestamptz                  -- when they accepted the terms of access
);

create table if not exists public.views (
  id          bigint generated always as identity primary key,
  email       text not null,
  viewed_at   timestamptz not null default now()
);
create index if not exists views_email_idx on public.views (email, viewed_at desc);

create table if not exists public.financials (
  id          int primary key default 1 check (id = 1),  -- single row
  doc         jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.auth_failures (
  id          bigint generated always as identity primary key,
  ip          text not null,
  at          timestamptz not null default now()
);
create index if not exists auth_failures_ip_idx on public.auth_failures (ip, at desc);

-- Dashboard passcode, stored as a SHA-256 hex hash. Changeable from the
-- dashboard (admin/change-passcode); the ADMIN_PASSCODE env secret is only
-- a bootstrap fallback used when this row doesn't exist yet.
create table if not exists public.admin_settings (
  id            int primary key default 1 check (id = 1),  -- single row
  passcode_hash text not null,
  updated_at    timestamptz not null default now()
);

-- Deny-all for anon/authenticated; Edge Functions use the service role (bypasses RLS).
alter table public.requests       enable row level security;
alter table public.investors      enable row level security;
alter table public.views          enable row level security;
alter table public.financials     enable row level security;
alter table public.auth_failures  enable row level security;
alter table public.admin_settings enable row level security;
