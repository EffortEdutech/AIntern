-- AIntern — 007_daily_log_v2_repeater_tasks (Phase A.2)
-- Seeds an OPT-IN variant of the daily log template with a repeatable
-- "Tasks Performed" group (one day can have several distinct tasks, each
-- with its own category + description), instead of one category + one
-- description per day.
--
-- IMPORTANT: this does NOT touch 'aintern-daily-log-v1' (seeded in
-- 002_seed_daily_template.sql). v1's field paths (tasks.task_category,
-- tasks.task_summary) are frozen into every approved_snapshot and
-- report_versions.content created under it so far — mutating v1 in place
-- would silently break how the LIVE (non-official) logbook preview
-- renders that historical data (it matches content against whatever
-- template is CURRENTLY assigned). v2 is a separate, additive template
-- row; interns opt in per-internship via internships.daily_template_id,
-- same mechanism Template Studio already uses for custom imports.
-- Already-approved entries and frozen official report versions are
-- entirely unaffected either way — they carry their own frozen template
-- reference and are immutable regardless of what's active today.

insert into public.templates
  (template_id, template_name, description, is_public, version, fields_schema)
values
  (
    'aintern-daily-log-v2',
    'Daily Task Sheet (multiple tasks per day)',
    'Universal internship daily activity log — attendance, MULTIPLE tasks with their own category and description, outcomes, learning, blockers.',
    true,
    '2.0',
    '{
      "sections": [
        {
          "section_id": "attendance",
          "section_name": "Attendance",
          "fields": [
            { "field_id": "entry_date", "field_name": "Date", "field_type": "date", "required": true, "default_value": "now" },
            { "field_id": "time_in",  "field_name": "Time in",  "field_type": "time", "required": true },
            { "field_id": "time_out", "field_name": "Time out", "field_type": "time", "required": true },
            { "field_id": "location", "field_name": "Location / Site", "field_type": "text", "required": false, "placeholder": "Office, site, remote..." }
          ]
        },
        {
          "section_id": "tasks",
          "section_name": "Tasks Performed",
          "fields": [
            { "field_id": "entries", "field_name": "Tasks Performed", "field_type": "repeater", "required": true,
              "item_fields": [
                { "field_id": "task_category", "field_name": "Task category", "field_type": "select", "required": true,
                  "options": ["Assigned work", "Project", "Training", "Meeting", "Other"] },
                { "field_id": "task_summary", "field_name": "What did you work on today?", "field_type": "textarea", "required": true, "rows": 4,
                  "placeholder": "Rough notes are fine - use AI polish to make it formal" }
              ]
            },
            { "field_id": "outcomes", "field_name": "Outcomes / deliverables", "field_type": "textarea", "required": false, "rows": 3,
              "placeholder": "What was completed or produced across today'"'"'s tasks?" },
            { "field_id": "hours_spent", "field_name": "Total hours spent", "field_type": "number", "required": false, "min": 0, "max": 24 }
          ]
        },
        {
          "section_id": "learning",
          "section_name": "Learning & Blockers",
          "fields": [
            { "field_id": "learned", "field_name": "What did you learn today?", "field_type": "textarea", "required": true, "rows": 3 },
            { "field_id": "blockers", "field_name": "Problems or blockers faced", "field_type": "textarea", "required": false, "rows": 3 },
            { "field_id": "help_needed", "field_name": "Help needed from supervisor", "field_type": "textarea", "required": false, "rows": 2 }
          ]
        }
      ]
    }'::jsonb
  )
on conflict (template_id) do update
  set fields_schema = excluded.fields_schema,
      template_name = excluded.template_name,
      description   = excluded.description,
      version       = excluded.version;
