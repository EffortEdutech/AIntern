/**
 * AIntern - Daily log field visibility (Profile-configurable)
 *
 * Interns can hide fields they don't need on their own daily log page
 * (e.g. "Location/Site") without going through a full custom-template
 * import. Preference lives in internships.metadata.field_prefs.hidden —
 * an array of "section_id.field_id" paths, the same key scheme fields
 * already use everywhere else (DynamicForm/FieldRenderer/fieldRows).
 * Default: nothing hidden, i.e. today's daily log page exactly.
 *
 * IMPORTANT: this only ever affects the live INPUT form (DailyLogPage).
 * Already-approved entries, the working logbook preview, and official
 * report versions always show whatever data exists regardless of the
 * CURRENT visibility setting — hiding a field going forward must never
 * make past evidence disappear, so nothing else in the render pipeline
 * (fieldRows.js, logbookPdf.js, logbookDocx.js, ReportPreview.jsx) reads
 * field_prefs at all.
 *
 * @file src/utils/fieldVisibility.js
 * @created July 12, 2026 - Phase A.2 (field visibility + repeatable tasks)
 */

export function fieldPath(section, field) {
  return `${section.section_id}.${field.field_id}`;
}

/**
 * Build the effective fields_schema for the INPUT form: hidden fields (and
 * any section left with none) are dropped entirely. Required-ness follows
 * naturally — a hidden required field can no longer block submission,
 * since DynamicForm's validator never sees it.
 */
export function applyFieldVisibility(template, internship) {
  const hidden = new Set(internship?.metadata?.field_prefs?.hidden ?? []);
  if (hidden.size === 0 || !template?.fields_schema?.sections) return template;

  const sections = template.fields_schema.sections
    .map((section) => ({
      ...section,
      fields: (section.fields ?? []).filter((f) => !hidden.has(fieldPath(section, f))),
    }))
    .filter((section) => section.fields.length > 0);

  return { ...template, fields_schema: { ...template.fields_schema, sections } };
}

export default applyFieldVisibility;
