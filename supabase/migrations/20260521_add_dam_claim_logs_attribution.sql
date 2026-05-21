alter table if exists public.dam_claim_logs
  add column if not exists visitor_id text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists gclid text,
  add column if not exists referrer text,
  add column if not exists landing_path text;
