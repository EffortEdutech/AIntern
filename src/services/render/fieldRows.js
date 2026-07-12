/**
 * AIntern - Shared entry-content -> display-rows helper
 *
 * Used by all three report renderers (PDF, DOCX, HTML live preview) so
 * they can never drift on how a field's value is displayed — the same
 * failure mode R2's shared `reportLayout.resolveLayout()` was built to
 * avoid, now extended to field *content* as well as presentation style.
 *
 * Introduced alongside the `list` field type (point-form daily
 * activities, PDF-import Case 1): a field value can now be a string
 * (single line) or an array of strings (bullets). `String(value)` would
 * flatten an array into "a,b,c" — `fieldValueLines()` normalizes either
 * shape into 1+ display lines instead, and callers render >1 line as
 * bullets, 1 line as plain text (unchanged for every existing field type).
 *
 * Phase A.2 added the `repeater` field type (e.g. multiple Tasks Performed
 * entries, each with its own category + description) — its value is an
 * array of OBJECTS, not strings. `String({...})` would render
 * "[object Object]", so repeater fields are formatted separately via
 * `repeaterLines()`, joining each item's sub-field values (in item_fields
 * order) into one bullet line per item, e.g. "Project — Fixed the bug".
 *
 * @file src/services/render/fieldRows.js
 * @created July 12, 2026 - Phase A (PDF-import Case 1)
 * @updated July 12, 2026 - Phase A.2: repeater field formatting
 */

/** Normalize a raw (non-repeater) field value into display lines. */
export function fieldValueLines(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const s = String(value).trim();
  return s ? [s] : [];
}

/** Format a repeater field's array-of-objects value into one line per item. */
export function repeaterLines(value, itemFields = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      return itemFields
        .map((sf) => String(item[sf.field_id] ?? '').trim())
        .filter(Boolean)
        .join(' — ');
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build display rows for one entry's content against its template's
 * fields_schema: [{ field_name, lines, section_name }], skipping
 * fields with no value. `lines.length > 1` signals a bulleted field.
 */
export function fieldRows(data, template) {
  const rows = [];
  (template?.fields_schema?.sections ?? []).forEach((section) => {
    (section.fields ?? []).forEach((f) => {
      const raw = data?.[`${section.section_id}.${f.field_id}`];
      const lines = f.field_type === 'repeater'
        ? repeaterLines(raw, f.item_fields)
        : fieldValueLines(raw);
      if (lines.length > 0) {
        rows.push({ field_name: f.field_name, lines, section_name: section.section_name });
      }
    });
  });
  return rows;
}

export default fieldRows;
