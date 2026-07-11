-- AIntern — 005_verify_report_public (v1.1 R3)
-- Applied July 11, 2026.
--
-- Public verification lookup (spec §27). SECURITY DEFINER,
-- anon-executable BY DESIGN: discloses ONLY the public-safe fields for
-- VERIFIED snapshots — intern name, institution, company, period,
-- status, version, hash. Never report content.

create or replace function public.verify_report(p_verification_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  r public.report_versions%rowtype;
begin
  select * into r
  from public.report_versions
  where verification_id = upper(trim(p_verification_id))
    and status = 'verified'
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'verification_id', r.verification_id,
    'status', r.status,
    'report_type', r.report_type,
    'version', r.version,
    'period_start', r.period_start,
    'period_end', r.period_end,
    'verified_at', r.created_at,
    'content_hash', r.content_hash,
    'intern_name', r.content->'intern'->>'full_name',
    'university', r.content->'intern'->>'university',
    'company', r.content->'internship'->>'company_name',
    'approved_entries', r.content->'stats'->'approved_entries',
    'evaluations', r.content->'stats'->'evaluations'
  );
end
$$;

revoke all on function public.verify_report(text) from public;
grant execute on function public.verify_report(text) to anon, authenticated;
