-- AIntern — 003_allow_rejected_resubmission (Session 6 review fix)
-- Applied July 10, 2026.
--
-- Gap: rejected submissions could never be resubmitted — the unique
-- (internship_id, entry_date) constraint blocked a fresh insert and the
-- delete policy only covered 'pending'. Interns may now clear their own
-- REJECTED rows so a revised log can be resubmitted as a fresh insert.
-- Approved rows remain untouchable; approved_snapshots is the immutable
-- audit authority. Rejected content is purged-by-design (plan §4.2) and
-- the supervisor comment is already mirrored into the local draft.

drop policy entry_submissions_owner_delete on public.entry_submissions;
create policy entry_submissions_owner_delete on public.entry_submissions
  for delete using (
    status in ('pending', 'rejected')
    and internship_id in (select id from public.internships where user_id = auth.uid())
  );
