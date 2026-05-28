create extension if not exists pgcrypto;

create table if not exists public.dam_scam_of_day_drafts (
  id uuid primary key default gen_random_uuid(),
  draft_date date not null,
  slug text not null,
  title text not null,
  candidate_pattern text,
  status text not null default 'draft',
  source_check_status text not null default 'incomplete',
  source_count int not null default 0,
  recent_claims_used int not null default 0,
  sessions_used int,
  body text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dam_scam_of_day_drafts_status_check
    check (status in ('draft', 'needs_review', 'approved', 'rejected', 'published_manually')),
  constraint dam_scam_of_day_drafts_source_check_status_check
    check (source_check_status in ('complete', 'incomplete')),
  constraint dam_scam_of_day_drafts_draft_date_key unique (draft_date),
  constraint dam_scam_of_day_drafts_slug_key unique (slug)
);

alter table public.dam_scam_of_day_drafts enable row level security;

revoke all on public.dam_scam_of_day_drafts from anon, authenticated;

comment on table public.dam_scam_of_day_drafts is
  'Admin-only Scam of the Day drafts. Use the server-side Supabase service role only; do not add public read policies.';
