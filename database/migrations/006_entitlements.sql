-- AIntern — 006_entitlements (Phase 4 S13: internship pass + trial gate)
-- Applied July 12, 2026.
--
-- MODEL (plan v0.3 §monetization + Phase 4 decisions):
--   * 7-day free trial from profile creation (derived — no column needed).
--   * One-time internship pass: 'pass_3m' (RM39) / 'pass_6m' (RM59).
--     Prices live in client config; the DB stores plan identity only.
--   * Activation sources: promo code (pilot), manual (SQL/dashboard),
--     payment (Phase 4b — provider integration after pricing validation).
--   * Gate: requesting supervisor reviews + creating official versions
--     require trial-or-pass. Bundled AI requires a PASS (trial = BYOK only).
--   * Drafting is FREE FOREVER — the intern never loses their data.
--
-- SECURITY: entitlements are written ONLY server-side (SECURITY DEFINER
-- redeem RPC / service role / dashboard). Owner may read their own rows.
-- Rows are immutable (audit trust model); passes stack by inserting new
-- rows whose expiry extends the latest one.

-- ============================================================
-- entitlements — who owns an active pass
-- ============================================================
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('pass_3m', 'pass_6m')),
  source text not null check (source in ('promo', 'manual', 'payment')),
  promo_code text,
  payment_ref text,                    -- provider reference (Phase 4b)
  activated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index entitlements_user_idx
  on public.entitlements (user_id, expires_at desc);

create trigger entitlements_immutable
  before update or delete on public.entitlements
  for each row execute function public.prevent_mutation();

alter table public.entitlements enable row level security;

-- Owner read-only; NO client write policies (server-side writes only).
create policy entitlements_owner_select on public.entitlements
  for select using (user_id = auth.uid());

-- ============================================================
-- promo_codes — pilot/manual activation
-- ============================================================
create table public.promo_codes (
  code text primary key,
  plan text not null check (plan in ('pass_3m', 'pass_6m')),
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

-- RLS on, ZERO policies: codes are never client-readable or writable.
-- Redemption happens exclusively through the SECURITY DEFINER RPC below.
alter table public.promo_codes enable row level security;

-- ============================================================
-- access_state(user) — single source of truth for gating
-- ============================================================
create or replace function public.access_state(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_created timestamptz;
  v_trial_end timestamptz;
  v_pass public.entitlements%rowtype;
begin
  select created_at into v_created from public.profiles where id = p_user;
  if v_created is null then
    select created_at into v_created from auth.users where id = p_user;
  end if;
  v_trial_end := coalesce(v_created, now()) + interval '7 days';

  select * into v_pass from public.entitlements
    where user_id = p_user and expires_at > now()
    order by expires_at desc
    limit 1;

  return jsonb_build_object(
    'trial_ends_at', v_trial_end,
    'trial_active', now() < v_trial_end,
    'pass', case when v_pass.id is null then null else jsonb_build_object(
      'plan', v_pass.plan,
      'source', v_pass.source,
      'activated_at', v_pass.activated_at,
      'expires_at', v_pass.expires_at
    ) end,
    'active', (now() < v_trial_end) or (v_pass.id is not null)
  );
end
$$;

-- NOTE: Supabase default privileges auto-grant EXECUTE to anon/authenticated
-- at creation, so the explicit revokes below are REQUIRED (advisor 0028).
revoke all on function public.access_state(uuid) from public;
revoke execute on function public.access_state(uuid) from anon, authenticated;
grant execute on function public.access_state(uuid) to service_role;

-- Client-facing wrapper: always scoped to the caller.
create or replace function public.get_access_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  return public.access_state(auth.uid());
end
$$;

revoke all on function public.get_access_state() from public;
revoke execute on function public.get_access_state() from anon;
grant execute on function public.get_access_state() to authenticated;

-- ============================================================
-- redeem_promo_code — the pilot activation path
-- ============================================================
create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_promo public.promo_codes%rowtype;
  v_months integer;
  v_base timestamptz;
  v_row public.entitlements%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_promo from public.promo_codes
    where code = v_code
    for update;
  if not found then
    raise exception 'Invalid code.';
  end if;
  if v_promo.expires_at is not null and v_promo.expires_at < now() then
    raise exception 'This code has expired.';
  end if;
  if v_promo.used_count >= v_promo.max_uses then
    raise exception 'This code has already been fully used.';
  end if;
  if exists (
    select 1 from public.entitlements
    where user_id = v_user and promo_code = v_promo.code
  ) then
    raise exception 'You have already used this code.';
  end if;

  update public.promo_codes
    set used_count = used_count + 1
    where code = v_promo.code;

  v_months := case v_promo.plan when 'pass_3m' then 3 else 6 end;
  -- Stacking: a new pass extends the latest active one, never overlaps-wastes.
  select greatest(now(), coalesce(max(expires_at), now()))
    into v_base
    from public.entitlements
    where user_id = v_user;

  insert into public.entitlements (user_id, plan, source, promo_code, expires_at)
    values (v_user, v_promo.plan, 'promo', v_promo.code,
            v_base + make_interval(months => v_months))
    returning * into v_row;

  return jsonb_build_object(
    'plan', v_row.plan,
    'expires_at', v_row.expires_at
  );
end
$$;

revoke all on function public.redeem_promo_code(text) from public;
revoke execute on function public.redeem_promo_code(text) from anon;
grant execute on function public.redeem_promo_code(text) to authenticated;

-- ============================================================
-- Gate create_report_snapshot (official versions need trial-or-pass).
-- Re-created from 004 with the access guard added after auth checks.
-- ============================================================
create or replace function public.create_report_snapshot(
  p_internship uuid,
  p_type text default 'logbook',
  p_start date default null,
  p_end date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_intern public.internships%rowtype;
  v_profile public.profiles%rowtype;
  v_template jsonb;
  v_version integer;
  v_entries jsonb;
  v_evals jsonb;
  v_pending integer;
  v_status text;
  v_vid text := null;
  v_content jsonb;
  v_hash text;
  v_row public.report_versions%rowtype;
  v_start date;
  v_end date;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_type not in ('logbook', 'weekly', 'monthly', 'final') then
    raise exception 'Invalid report type';
  end if;

  -- Phase 4 gate: official versions require an active trial or pass.
  if not coalesce((public.access_state(v_user)->>'active')::boolean, false) then
    raise exception 'PASS_REQUIRED: Your free trial has ended — activate an internship pass to create official report versions.';
  end if;

  select * into v_intern from public.internships
    where id = p_internship and user_id = v_user;
  if not found then
    raise exception 'Internship not found';
  end if;

  v_start := coalesce(p_start, v_intern.start_date);
  v_end   := coalesce(p_end, least(v_intern.end_date, current_date));

  select * into v_profile from public.profiles where id = v_user;

  select to_jsonb(t) - 'created_at' - 'updated_at' into v_template
  from public.templates t
  where (v_intern.daily_template_id is not null and t.id = v_intern.daily_template_id)
     or (v_intern.daily_template_id is null and t.template_id = 'aintern-daily-log-v1')
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
      'snapshot_id', s.id,
      'entry_date', s.entry_date,
      'client_created_at', s.client_created_at,
      'content', s.content,
      'supervisor_name', s.supervisor_name,
      'supervisor_comment', s.supervisor_comment,
      'supervisor_signature', s.supervisor_signature,
      'approved_at', s.approved_at,
      'entry_hash', s.audit->>'entry_hash'
    ) order by s.entry_date), '[]'::jsonb)
  into v_entries
  from public.approved_snapshots s
  where s.internship_id = p_internship
    and s.entry_date between v_start and v_end;

  select coalesce(jsonb_agg(jsonb_build_object(
      'evaluation_id', e.id,
      'period_start', e.period_start,
      'period_end', e.period_end,
      'cadence_days', e.cadence_days,
      'summary', e.summary,
      'scores', e.scores,
      'custom_kpis', e.custom_kpis,
      'comments', e.comments,
      'supervisor_name', e.supervisor_name,
      'supervisor_signature', e.supervisor_signature,
      'submitted_at', e.submitted_at
    ) order by e.period_start), '[]'::jsonb)
  into v_evals
  from public.evaluations e
  where e.internship_id = p_internship
    and e.period_start >= v_start and e.period_end <= v_end;

  select count(*) into v_pending
  from public.entry_submissions
  where internship_id = p_internship
    and status = 'pending'
    and entry_date between v_start and v_end;

  v_status := case
    when jsonb_array_length(v_entries) > 0 and v_pending = 0 then 'verified'
    else 'unverified'
  end;

  select coalesce(max(version), 0) + 1 into v_version
  from public.report_versions
  where internship_id = p_internship and report_type = p_type;

  v_content := jsonb_build_object(
    'intern', jsonb_build_object(
      'full_name', v_profile.full_name,
      'university', v_profile.university,
      'course', v_profile.course
    ),
    'internship', jsonb_build_object(
      'company_name', v_intern.company_name,
      'department', v_intern.department,
      'supervisor_name', v_intern.supervisor_name,
      'supervisor_email', v_intern.supervisor_email,
      'start_date', v_intern.start_date,
      'end_date', v_intern.end_date,
      'evaluation_cadence_days', v_intern.evaluation_cadence_days
    ),
    'template', v_template,
    'period', jsonb_build_object('start', v_start, 'end', v_end),
    'entries', v_entries,
    'evaluations', v_evals,
    'stats', jsonb_build_object(
      'approved_entries', jsonb_array_length(v_entries),
      'evaluations', jsonb_array_length(v_evals),
      'pending_in_period', v_pending
    )
  );

  v_hash := encode(extensions.digest(v_content::text, 'sha256'), 'hex');

  if v_status = 'verified' then
    v_vid := 'AIN-'
      || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-'
      || upper(substr(md5(gen_random_uuid()::text), 1, 4));
  end if;

  insert into public.report_versions
    (internship_id, report_type, version, status, period_start, period_end,
     content, content_hash, verification_id)
  values
    (p_internship, p_type, v_version, v_status, v_start, v_end,
     v_content, v_hash, v_vid)
  returning * into v_row;

  return to_jsonb(v_row);
end
$$;
