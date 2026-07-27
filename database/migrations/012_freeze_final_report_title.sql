-- AIntern - 012_freeze_final_report_title
--
-- Re-create create_report_snapshot() so final report versions freeze the
-- report title together with the already-frozen chapter list and narrative
-- draft. Verification remains unchanged.

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
  v_final_report_title text;
  v_report_center_template jsonb;
  v_selected_template_id text;
  v_defs jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_type not in ('logbook', 'weekly', 'monthly', 'final') then
    raise exception 'Invalid report type';
  end if;

  if not coalesce((public.access_state(v_user)->>'active')::boolean, false) then
    raise exception 'PASS_REQUIRED: Your free trial has ended - activate an internship pass to create official report versions.';
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

  if p_type = 'final' then
    select t.template_name, t.pdf_layout->'final_report'->'chapters'
    into v_final_report_title, v_chapters
    from public.templates t
    where t.id = v_intern.final_report_template_id;

    if v_chapters is null then
      select t.template_name, t.pdf_layout->'final_report'->'chapters'
      into v_final_report_title, v_chapters
      from public.templates t
      where t.template_id = 'aintern-final-report-default'
      limit 1;
    end if;

    v_final_report_title := coalesce(nullif(v_final_report_title, ''), 'Final Training Report');
    v_draft := coalesce(v_intern.metadata->'final_report_draft', '{}'::jsonb);
  else
    v_chapters := null;
    v_draft := null;
    v_final_report_title := null;
  end if;

  if p_type in ('weekly', 'monthly') then
    v_selected_template_id := coalesce(
      v_intern.metadata->'report_templates'->>p_type,
      case when p_type = 'monthly' then 'monthly_combined' else 'weekly_narrative' end
    );

    v_defs := v_intern.metadata->'report_template_defs'->p_type;
    if v_defs is not null then
      select value into v_report_center_template
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_defs) = 'array' then v_defs
          else jsonb_build_array(v_defs)
        end
      ) as t(value)
      where value->>'id' = v_selected_template_id
      limit 1;
    end if;

    if v_report_center_template is null then
      v_report_center_template := case v_selected_template_id
        when 'weekly_table' then jsonb_build_object(
          'id', 'weekly_table',
          'report_type', 'weekly',
          'name', 'Weekly Table Report',
          'description', 'A compact tabular weekly activity report for institutions that prefer structured logs.',
          'layout', jsonb_build_object(
            'title', 'Weekly Industrial Training Activity Table',
            'density', 'compact',
            'show_cover', true,
            'show_signatures', true,
            'show_comments', true,
            'show_evaluations', false,
            'footer_text', 'AIntern Weekly Table Report'
          ),
          'sections', jsonb_build_array(
            jsonb_build_object('id', 'student_info', 'title', 'Student & Placement Information', 'kind', 'profile_info', 'source', 'profile+internship'),
            jsonb_build_object('id', 'activity_table', 'title', 'Approved Daily Activities', 'kind', 'auto_entries_table', 'source', 'approved_snapshots'),
            jsonb_build_object('id', 'hours_summary', 'title', 'Hours / Attendance Summary', 'kind', 'computed_summary', 'source', 'approved_snapshots'),
            jsonb_build_object('id', 'supervisor_comments', 'title', 'Supervisor Comments', 'kind', 'comments_table', 'source', 'approved_snapshots'),
            jsonb_build_object('id', 'supervisor_verification', 'title', 'Supervisor Verification', 'kind', 'signature', 'source', 'approved_snapshots')
          )
        )
        when 'monthly_combined' then jsonb_build_object(
          'id', 'monthly_combined',
          'report_type', 'monthly',
          'name', 'Monthly Combined Report',
          'description', 'Monthly tables plus narrative reflection and supervisor evaluation summary.',
          'layout', jsonb_build_object(
            'title', 'Monthly Industrial Training Report',
            'density', 'normal',
            'show_cover', true,
            'show_signatures', true,
            'show_comments', true,
            'show_evaluations', true,
            'footer_text', 'AIntern Monthly Report'
          ),
          'sections', jsonb_build_array(
            jsonb_build_object('id', 'student_info', 'title', 'Student & Placement Information', 'kind', 'profile_info', 'source', 'profile+internship'),
            jsonb_build_object('id', 'monthly_summary', 'title', 'Monthly Summary', 'kind', 'computed_summary', 'source', 'approved_snapshots+evaluations'),
            jsonb_build_object('id', 'activity_table', 'title', 'Approved Activity Table', 'kind', 'auto_entries_table', 'source', 'approved_snapshots'),
            jsonb_build_object('id', 'reflection', 'title', 'Monthly Reflection', 'kind', 'narrative', 'source', 'intern_written'),
            jsonb_build_object('id', 'skills_growth', 'title', 'Skills Growth and Learning Outcomes', 'kind', 'narrative', 'source', 'intern_written'),
            jsonb_build_object('id', 'evaluation_summary', 'title', 'Supervisor Evaluation Summary', 'kind', 'auto_evaluations', 'source', 'evaluations'),
            jsonb_build_object('id', 'next_month_plan', 'title', 'Plan for Next Month', 'kind', 'narrative', 'source', 'intern_written'),
            jsonb_build_object('id', 'verification', 'title', 'Supervisor Verification', 'kind', 'signature', 'source', 'approved_snapshots+evaluations')
          )
        )
        else jsonb_build_object(
          'id', 'weekly_narrative',
          'report_type', 'weekly',
          'name', 'Weekly Narrative Report',
          'description', 'A reflection-led weekly report with evidence-backed activity summaries.',
          'layout', jsonb_build_object(
            'title', 'Weekly Industrial Training Report',
            'density', 'normal',
            'show_cover', true,
            'show_signatures', true,
            'show_comments', true,
            'show_evaluations', false,
            'footer_text', 'AIntern Weekly Report'
          ),
          'sections', jsonb_build_array(
            jsonb_build_object('id', 'student_info', 'title', 'Student & Placement Information', 'kind', 'profile_info', 'source', 'profile+internship'),
            jsonb_build_object('id', 'weekly_overview', 'title', 'Weekly Overview', 'kind', 'narrative', 'source', 'intern_written'),
            jsonb_build_object('id', 'daily_activity_summary', 'title', 'Daily Activity Summary', 'kind', 'auto_entries_narrative', 'source', 'approved_snapshots'),
            jsonb_build_object('id', 'skills_learned', 'title', 'Skills / Knowledge Learned', 'kind', 'narrative', 'source', 'intern_written'),
            jsonb_build_object('id', 'challenges', 'title', 'Problems Faced and Solutions', 'kind', 'narrative', 'source', 'intern_written'),
            jsonb_build_object('id', 'supervisor_verification', 'title', 'Supervisor Verification', 'kind', 'signature', 'source', 'approved_snapshots')
          )
        )
      end;
    end if;
  else
    v_report_center_template := null;
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
    'report_center_template', v_report_center_template,
    'final_report_title', v_final_report_title,
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
