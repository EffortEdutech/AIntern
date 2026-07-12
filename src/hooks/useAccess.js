/**
 * AIntern - useAccess (Phase 4 S13)
 *
 * Shared access state for gating UX. Module-level cache means one RPC
 * per app load, not per page; call refresh() after redeeming a code.
 * REMEMBER: this is UX only — the server independently enforces every
 * gated action.
 *
 * @file src/hooks/useAccess.js
 * @created July 12, 2026 - Phase 4 S13
 */

import { useCallback, useEffect, useState } from 'react';
import { entitlementService } from '../services/api/entitlementService';

let cache = null;

export function useAccess() {
  const [access, setAccess] = useState(cache);
  const [loading, setLoading] = useState(!cache);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await entitlementService.getAccess();
    if (res.success) {
      cache = res.data;
      setAccess(res.data);
    }
    setLoading(false);
    return res;
  }, []);

  useEffect(() => {
    if (!cache) refresh();
  }, [refresh]);

  return { access, loading, refresh };
}

export default useAccess;
