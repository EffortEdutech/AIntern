-- AIntern — 004_report_versions (v1.1 R1: Report Engine foundation)
-- Applied July 11, 2026.
--
-- Report-level immutable snapshots per spec v1.1 §11-12, §19-20.
-- Entry-level approved_snapshots remain the EVIDENCE layer; report
-- versions freeze a composition of that evidence + template labels.
--
-- SECURITY: verified status is computed SERVER-SIDE inside a
-- SECURITY DEFINER RPC — clients cannot mint 'verified' records.
-- verified = at least one approved entry in period AND zero pending
-- submissions in period. Verified snapshots receive a permanent
-- Verification ID (public /verify page arrives in R3).

create extension if not exists pgcrypto;

create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships(id) on delete restrict,
  report_type text not null default 'logbook'
    check (report_type in ('logbook', 'weekly', 'monthly', 'final')),
  version integer not null,
  status text not null check (status in ('unverified', 'verified')),
  period_start date not null,
  period_end date not null,
  content jsonb not null,          -- frozen: intern, internship, template, entries, evaluations, stats
  content_hash text not null,      -- sha256 of content
  verification_id text unique,     -- only for verified snapshots
  created_at timestamptz not null default now(),
  unique (internship_id, report_type, version),
  check (period_end >= period_start)
);

create index report_versions_internship_idx
  on public.report_versions (internship_id, report_type, version desc);

create trigger report_versions_immutable
  before update or delete on public.report_versions
  for each row execute function public.prevent_mutation();

alter table public.report_versions enable row level security;

-- Owner read-only; ALL writes go through the RPC below.
create policy report_versions_owner_select on public.report_versions
  for select using (
    internship_id in (select id from public.internships where user_id = auth.uid())
  );

-- ============================================================
-- create_report_snapshot — the only write path
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

  select * into v_intern from public.internships
    where id = p_internship and user_id = v_user;
  if not found then
    raise exception 'Internship not found';
  end if;

  v_start := coalesce(p_start, v_intern.start_date);
  v_end   := coalesce(p_end, least(v_intern.end_date, current_date));

  select * into v_profile from public.profiles where id = v_user;

  -- Freeze the template (labels travel with the snapshot)
  select to_jsonb(t) - 'created_at' - 'updated_at' into v_template
  from public.templates t
  where (v_intern.daily_template_id is not null and t.id = v_intern.daily_template_id)
     or (v_intern.daily_template_id is null and t.template_id = 'aintern-daily-log-v1')
  limit 1;

  -- Evidence layer: approved entries in period (already immutable + signed)
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

  -- Server-side verification rule (R1)
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

revoke all on function public.create_report_snapshot(uuid, text, date, date) from public;
grant execute on function public.create_report_snapshot(uuid, text, date, date) to authenticated;
