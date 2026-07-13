/**
 * AIntern - Shared verification payload builder (spec v1.1 §25-27)
 *
 * Extracted from LogbookPage.jsx so the Final Report page (Phase B) can
 * build the same payload for its own exports without a second copy —
 * every exported document's Verification Appendix + QR must describe the
 * SAME record, computed the SAME way, regardless of which page triggered
 * the export.
 *
 * @file src/services/render/verification.js
 * @created July 12, 2026 - Phase B
 */

/** Verification payload for exports of a VERIFIED report_versions row. */
export function verificationOf(v) {
  if (v?.status !== 'verified' || !v?.verification_id) return null;
  return {
    verification_id: v.verification_id,
    version: v.version,
    created_at: v.created_at,
    content_hash: v.content_hash,
    verify_url: `${window.location.origin}/verify?id=${v.verification_id}`,
  };
}

export default verificationOf;
