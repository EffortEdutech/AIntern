/**
 * AIntern - useTerminology
 *
 * Returns a label lookup: t('entry') → "Daily Log" (or the internship's
 * override, e.g. "Shift Log"). Engine components must use this instead
 * of hardcoded nouns so terminology stays industry-agnostic.
 *
 * Overrides are read from the active internship's metadata.terminology
 * (passed in by the caller — the hook stays context-free so it can be
 * used before InternshipContext exists).
 *
 * @file src/hooks/useTerminology.js
 * @created July 9, 2026 - Session 2
 */

import { useCallback } from 'react';
import { TERMINOLOGY_DEFAULTS } from '../config/platform';

export function useTerminology(overrides = {}) {
  const t = useCallback(
    (key) => overrides?.[key] ?? TERMINOLOGY_DEFAULTS[key] ?? key,
    [overrides]
  );
  return t;
}

export default useTerminology;
