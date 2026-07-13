-- AIntern — 009_final_report_snapshot (Phase B: full training-report import, Case 2)
--
-- Re-created from 006's create_report_snapshot() (which added the Phase 4
-- pass/trial gate on top of 004's original) — byte-faithful except for the
-- new chapters/narrative_draft freezing, added ONLY for p_type = 'final'.
--
-- IMPORTANT: the verification rule itself is NOT touched, for ANY report
-- type including 'final' — still purely "≥1 approved entry AND 0 pending
-- in period ⇒ verified", computed the same way it always has been. A
-- 'final' report's narrative chapters are presentation/authoring content;
-- they carry no weight in whether the record is verified. Clients still
-- cannot influence verification status.

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
  v_chapters jsonb;
  v_draft jsonb;
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

  -- Phase B: freeze the final-report chapter structure + narrative draft.
  -- Every other report type keeps these null (unchanged behavior for
  -- 'logbook'/'weekly'/'monthly').
  if p_type = 'final' then
    select t.pdf_layout->'final_report'->'chapters' into v_chapters
    from public.templates t
    where t.id = v_intern.final_report_template_id;

    if v_chapters is null then
      select t.pdf_layout->'final_report'->'chapters' into v_chapters
      from public.templates t
      where t.template_id = 'aintern-final-report-default'
      limit 1;
    end if;

    v_draft := coalesce(v_intern.metadata->'final_report_draft', '{}'::jsonb);
  else
    v_chapters := null;
    v_draft := null;
  end if;

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

  -- Server-side verification rule (R1) — unchanged for every report type.
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
    'chapters', v_chapters,
    'narrative_draft', v_draft,
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
