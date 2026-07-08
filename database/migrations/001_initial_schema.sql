-- AIntern — 001_initial_schema
-- Applied to Supabase project wdhdjhvvngssnszqgiyk (July 9, 2026)
-- Trust model: device = draft authority; Supabase = approval/audit authority.
-- approved_snapshots and evaluations are IMMUTABLE (trigger-enforced).

-- ============================================================
-- Helpers
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.prevent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'AIntern: % records are immutable', tg_table_name;
end $$;

-- ============================================================
-- profiles — intern identity (1:1 with auth.users)
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  university text,
  course text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- templates — JSONB form definitions (WorkLedger engine shape)
-- ============================================================

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  template_id text not null unique,
  template_name text not null,
  description text,
  fields_schema jsonb not null,
  validation_rules jsonb not null default '{}'::jsonb,
  pdf_layout jsonb not null default '{}'::jsonb,
  version text not null default '1.0',
  is_public boolean not null default false,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

-- ============================================================
-- internships — the placement (intern-owned)
-- ============================================================

create table public.internships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  department text,
  supervisor_name text not null,
  supervisor_email text not null,
  start_date date not null,
  end_date date not null,
  evaluation_cadence_days integer not null default 7
    check (evaluation_cadence_days in (7, 14, 30)),
  digest_mode text not null default 'daily'
    check (digest_mode in ('per-entry', 'daily', 'batch')),
  daily_template_id uuid references public.templates(id),
  evaluation_template_id uuid references public.templates(id),
  pass_status text not null default 'trial'
    check (pass_status in ('trial', 'active', 'expired')),
  trial_started_at timestamptz not null default now(),
  pass_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, -- custom KPIs, deadline policy, week convention
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index internships_user_idx on public.internships (user_id);

create trigger internships_updated_at before update on public.internships
  for each row execute function public.set_updated_at();

-- ============================================================
-- entry_submissions — transient staging for supervisor review
-- (drafts live on-device; rows appear here only when submitted)
-- ============================================================

create table public.entry_submissions (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships(id) on delete cascade,
  entry_date date not null,
  client_created_at timestamptz not null, -- device timestamp (late-flag authority)
  data jsonb not null,                    -- purged (set to '{}') on rejection
  photo_paths jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  supervisor_comment text,
  token_id uuid,
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (internship_id, entry_date)
);

create index entry_submissions_pending_idx
  on public.entry_submissions (internship_id, status);

-- ============================================================
-- approved_snapshots — IMMUTABLE audit record of approved work
-- ============================================================

create table public.approved_snapshots (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships(id) on delete restrict,
  submission_id uuid references public.entry_submissions(id) on delete set null,
  entry_date date not null,
  client_created_at timestamptz not null,
  content jsonb not null,
  photo_hashes jsonb not null default '[]'::jsonb,
  photo_paths jsonb not null default '[]'::jsonb,
  supervisor_name text not null,
  supervisor_email text not null,
  supervisor_signature text,       -- storage path
  supervisor_comment text,
  token_id uuid,
  audit jsonb not null default '{}'::jsonb, -- ip, user_agent, entry_hash
  approved_at timestamptz not null default now()
);

create index approved_snapshots_internship_idx
  on public.approved_snapshots (internship_id, entry_date);

create trigger approved_snapshots_immutable
  before update or delete on public.approved_snapshots
  for each row execute function public.prevent_mutation();

-- ============================================================
-- evaluations — IMMUTABLE periodic supervisor evaluations
-- ============================================================

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  cadence_days integer not null,
  summary jsonb not null default '{}'::jsonb,     -- prefilled aggregates
  scores jsonb not null default '{}'::jsonb,      -- rubric ratings
  custom_kpis jsonb not null default '[]'::jsonb, -- up to 3, from internship metadata
  comments jsonb not null default '{}'::jsonb,    -- strengths / improvements / next
  supervisor_name text not null,
  supervisor_email text not null,
  supervisor_signature text,
  token_id uuid,
  audit jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index evaluations_internship_idx
  on public.evaluations (internship_id, period_start);

create trigger evaluations_immutable
  before update or delete on public.evaluations
  for each row execute function public.prevent_mutation();

-- ============================================================
-- approval_tokens — single-purpose supervisor magic links
-- (written/validated only by Edge Functions with service role)
-- ============================================================

create table public.approval_tokens (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships(id) on delete cascade,
  purpose text not null check (purpose in ('entry_batch', 'evaluation')),
  payload jsonb not null default '{}'::jsonb, -- submission ids / evaluation period
  token_hash text not null unique,            -- sha256 of the raw token; raw never stored
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index approval_tokens_internship_idx on public.approval_tokens (internship_id);

-- ============================================================
-- ai_credentials — BYOK keys (ciphertext only; encrypt/decrypt in Edge Functions)
-- ============================================================

create table public.ai_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- ============================================================
-- ai_usage — bundled-tier metering (inserts via service role only)
-- ============================================================

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('polish', 'eval_comment', 'template_import')),
  provider text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_user_month_idx on public.ai_usage (user_id, created_at);

-- ============================================================
-- Row Level Security — owner-based; supervisor flows use service role
-- ============================================================

alter table public.profiles enable row level security;
alter table public.templates enable row level security;
alter table public.internships enable row level security;
alter table public.entry_submissions enable row level security;
alter table public.approved_snapshots enable row level security;
alter table public.evaluations enable row level security;
alter table public.approval_tokens enable row level security;
alter table public.ai_credentials enable row level security;
alter table public.ai_usage enable row level security;

-- profiles: owner full control
create policy profiles_owner on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- templates: public read for seeded templates; owner full control of own
create policy templates_read on public.templates
  for select using (is_public or owner_id = auth.uid());
create policy templates_owner_insert on public.templates
  for insert with check (owner_id = auth.uid());
create policy templates_owner_update on public.templates
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy templates_owner_delete on public.templates
  for delete using (owner_id = auth.uid());

-- internships: owner full control
create policy internships_owner on public.internships
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- entry_submissions: intern may create/read own; resolution happens via service role
create policy entry_submissions_owner_select on public.entry_submissions
  for select using (
    internship_id in (select id from public.internships where user_id = auth.uid())
  );
create policy entry_submissions_owner_insert on public.entry_submissions
  for insert with check (
    internship_id in (select id from public.internships where user_id = auth.uid())
  );
-- interns may withdraw a still-pending submission
create policy entry_submissions_owner_delete on public.entry_submissions
  for delete using (
    status = 'pending'
    and internship_id in (select id from public.internships where user_id = auth.uid())
  );

-- approved_snapshots: owner read-only; writes via service role only
create policy approved_snapshots_owner_select on public.approved_snapshots
  for select using (
    internship_id in (select id from public.internships where user_id = auth.uid())
  );

-- evaluations: owner read-only; writes via service role only
create policy evaluations_owner_select on public.evaluations
  for select using (
    internship_id in (select id from public.internships where user_id = auth.uid())
  );

-- approval_tokens: owner may see status (not hash column exposure is acceptable:
-- only the hash is stored, never the raw token); all writes via service role
create policy approval_tokens_owner_select on public.approval_tokens
  for select using (
    internship_id in (select id from public.internships where user_id = auth.uid())
  );

-- ai_credentials: owner manages own ciphertext rows
create policy ai_credentials_owner on public.ai_credentials
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ai_usage: owner read-only; inserts via service role
create policy ai_usage_owner_select on public.ai_usage
  for select using (user_id = auth.uid());

-- ============================================================
-- 002 (applied as fix_function_search_path): pin search_path
-- ============================================================
-- alter function public.set_updated_at() set search_path = '';
-- alter function public.prevent_mutation() set search_path = '';
