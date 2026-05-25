create extension if not exists pgcrypto;

create table if not exists raw_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_url text,
  external_id text not null,
  author_name text,
  author_url text,
  title text,
  body text,
  published_at timestamptz,
  collected_at timestamptz not null default now(),
  raw_json jsonb not null default '{}'::jsonb,
  dedupe_hash text not null unique,
  processed_at timestamptz
);

create index if not exists raw_items_source_idx on raw_items(source);
create index if not exists raw_items_processed_idx on raw_items(processed_at);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  raw_item_id uuid references raw_items(id) on delete cascade,
  platform text not null,
  opportunity_type text not null,
  summary text,
  pain_point text,
  xrworkout_relevance text,
  audience_type text,
  score integer not null default 0 check (score between 0 and 100),
  priority text not null default 'low' check (priority in ('high', 'medium', 'low')),
  recommended_action text not null default 'monitor',
  outreach_safety text not null default 'review',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(raw_item_id)
);

create index if not exists opportunities_priority_idx on opportunities(priority, status);

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null,
  profile_url text not null,
  public_contact text,
  niche text,
  audience_estimate text,
  audience_quality text,
  recent_relevant_content text,
  fit_reason text,
  offer_angle text,
  priority text not null default 'low' check (priority in ('high', 'medium', 'low')),
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform, profile_url)
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete set null,
  creator_id uuid references creators(id) on delete set null,
  channel text not null,
  subject text,
  body text not null,
  status text not null default 'needs_review' check (status in ('needs_review', 'approved', 'sent', 'rejected', 'edit_needed')),
  approved_by text,
  sent_at timestamptz,
  response_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drafts_status_idx on drafts(status);

create or replace function get_high_priority_opportunities_without_drafts(row_limit integer default 25)
returns setof opportunities
language sql
stable
as $$
  select o.*
  from opportunities o
  left join drafts d on d.opportunity_id = o.id
  where o.priority = 'high'
    and o.status = 'new'
    and d.id is null
  order by o.score desc, o.created_at asc
  limit row_limit;
$$;

create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references drafts(id) on delete cascade,
  due_date date not null,
  cadence_step integer not null check (cadence_step in (1, 2)),
  draft_body text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists followups_due_idx on followups(due_date, status);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  offer_type text not null default '3 months free',
  code_or_link text,
  sent_at timestamptz,
  redeemed boolean not null default false,
  content_committed boolean not null default false,
  content_url text,
  outcome text,
  created_at timestamptz not null default now()
);

create table if not exists dashboard_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action_type text not null,
  target_table text not null,
  target_id text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dashboard_audit_logs_created_idx on dashboard_audit_logs(created_at desc);
create index if not exists dashboard_audit_logs_target_idx on dashboard_audit_logs(target_table, target_id);
