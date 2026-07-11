/**
 * AIntern - Report Layout Resolver (v1.1 R2 — presentation templates)
 *
 * Spec v1.1 §14-18: presentation rules are configuration, not code.
 * Resolution chain (later wins):
 *
 *   LAYOUT_DEFAULTS
 *     ← template.pdf_layout.report   (institution rules; frozen into
 *                                     report snapshots with the template)
 *     ← internship.metadata.report_prefs  (student preferences, §18)
 *
 * The SAME resolved layout feeds both the HTML live preview (§29) and
 * the PDF generator — preview and export can never disagree.
 *
 * @file src/services/render/reportLayout.js
 * @created July 11, 2026 - v1.1 R2
 */

export const LAYOUT_DEFAULTS = {
  title: 'Internship Logbook',
  accent: [15, 23, 42],      // slate-900
  show_cover: true,
  show_signatures: true,
  show_comments: true,
  show_evaluations: true,
  footer_text: null,          // null → "<name> — <title>"
  density: 'normal',          // 'normal' | 'compact'
};

/** Accent swatches offered to students (§18 personalisation). */
export const ACCENT_CHOICES = [
  { name: 'Slate', rgb: [15, 23, 42] },
  { name: 'Navy', rgb: [30, 58, 138] },
  { name: 'Emerald', rgb: [6, 78, 59] },
  { name: 'Maroon', rgb: [127, 29, 29] },
];

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function normalizeAccent(accent, fallback) {
  if (Array.isArray(accent) && accent.length === 3 && accent.every((v) => Number.isFinite(v))) {
    return accent.map((v) => Math.min(255, Math.max(0, Math.round(v))));
  }
  if (typeof accent === 'string') {
    const rgb = hexToRgb(accent);
    if (rgb) return rgb;
  }
  return fallback;
}

/**
 * Resolve the effective layout for a report.
 * @param {Object|null} template   - templates row (may carry pdf_layout.report)
 * @param {Object|null} internship - internships row (metadata.report_prefs)
 */
export function resolveLayout(template = null, internship = null) {
  const institution = template?.pdf_layout?.report ?? {};
  const prefs = internship?.metadata?.report_prefs ?? {};
  const merged = { ...LAYOUT_DEFAULTS, ...institution, ...prefs };
  merged.accent = normalizeAccent(merged.accent, LAYOUT_DEFAULTS.accent);
  merged.title = String(merged.title || LAYOUT_DEFAULTS.title).slice(0, 80);
  merged.density = merged.density === 'compact' ? 'compact' : 'normal';
  return merged;
}

export const accentCss = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

export default resolveLayout;
