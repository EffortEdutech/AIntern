-- AIntern — 002_seed_daily_template
-- Seeds the universal Daily Task Sheet v1 (public template).
-- Photos & intern signature arrive with the submission flow (Phase 2);
-- the calculated-hours field is deferred (engine renders it read-only
-- without computing) — hours_spent is a plain number field for now.

insert into public.templates
  (template_id, template_name, description, is_public, version, fields_schema)
values
  (
    'aintern-daily-log-v1',
    'Daily Task Sheet',
    'Universal internship daily activity log — attendance, tasks, outcomes, learning, blockers.',
    true,
    '1.0',
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
            { "field_id": "task_category", "field_name": "Task category", "field_type": "select", "required": true,
              "options": ["Assigned work", "Project", "Training", "Meeting", "Other"] },
            { "field_id": "task_summary", "field_name": "What did you work on today?", "field_type": "textarea", "required": true, "rows": 5,
              "placeholder": "Rough notes are fine - use AI polish to make it formal" },
            { "field_id": "outcomes", "field_name": "Outcomes / deliverables", "field_type": "textarea", "required": false, "rows": 3,
              "placeholder": "What was completed or produced?" },
            { "field_id": "hours_spent", "field_name": "Hours spent", "field_type": "number", "required": false, "min": 0, "max": 24 }
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
