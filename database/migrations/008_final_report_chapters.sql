-- AIntern — 008_final_report_chapters (Phase B: full training-report import, Case 2)
--
-- Adds the internship-side pointer to a "final report" chapter structure,
-- mirroring the existing daily_template_id / evaluation_template_id slots.
-- The chapter STRUCTURE itself needs no new column: templates.pdf_layout
-- already exists and already holds presentation config at pdf_layout.report
-- (v1.1 R2) — chapters live alongside it at pdf_layout.final_report.chapters,
-- same reuse-don't-duplicate pattern.
--
-- Seeds a generic default template ('aintern-final-report-default') so the
-- feature works before any institution-specific report is imported: a few
-- narrative chapters (student-authored, optionally AI draft-assisted from
-- the intern's own evidence) plus the EXISTING approved entries/evaluations
-- as auto-populated appendix chapters. Chapters are never a substitute for
-- entries/evaluations evidence — 'auto_entries'/'auto_evaluations' chapters
-- render straight from the same frozen data create_report_snapshot() has
-- always captured; only the ordering/framing around them is configurable.

alter table public.internships
  add column if not exists final_report_template_id uuid references public.templates(id);

insert into public.templates
  (template_id, template_name, description, is_public, version, fields_schema, pdf_layout)
values
  (
    'aintern-final-report-default',
    'Final Training Report (default)',
    'Generic final training report structure - narrative chapters plus the approved logbook and evaluations as appendices. Import your own institution''s report format via Report Studio to replace this.',
    true,
    '1.0',
    '{"sections": []}'::jsonb,
    '{
      "final_report": {
        "chapters": [
          { "chapter_id": "introduction", "chapter_title": "Introduction", "kind": "narrative", "ai_draftable": false,
            "guidance": "Describe your internship: when it started/ended, hours per week, where you were based, and your learning goals." },
          { "chapter_id": "company_profile", "chapter_title": "Organizational Profile", "kind": "narrative", "ai_draftable": false,
            "guidance": "Describe the company: industry, products/services, organizational structure, and the unit you reported into." },
          { "chapter_id": "logbook_appendix", "chapter_title": "Appendix A: Daily Activity Log", "kind": "auto_entries", "ai_draftable": false,
            "guidance": "Your approved daily entries, included automatically." },
          { "chapter_id": "evaluations_appendix", "chapter_title": "Appendix B: Supervisor Evaluations", "kind": "auto_evaluations", "ai_draftable": false,
            "guidance": "Your supervisor evaluations, included automatically." },
          { "chapter_id": "reflection", "chapter_title": "Training Reflection", "kind": "narrative", "ai_draftable": true,
            "guidance": "Reflect on what you learned, contributed, and how this experience shaped your goals." },
          { "chapter_id": "conclusion", "chapter_title": "Conclusion & Recommendations", "kind": "narrative", "ai_draftable": true,
            "guidance": "Summarize your experience and any recommendations for future interns or the host company." }
        ]
      }
    }'::jsonb
  )
on conflict (template_id) do update
  set pdf_layout = excluded.pdf_layout,
      template_name = excluded.template_name,
      description = excluded.description,
      version = excluded.version;
