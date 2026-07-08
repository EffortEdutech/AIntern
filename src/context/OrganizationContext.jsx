/**
 * WorkLedger - Organization Context
 *
 * Manages the active organization for the current session.
 * Provides org switching for Bina Jaya staff and org-scoped data access.
 *
 * SESSION 9:  Initial implementation
 * SESSION 11: Added userOrgRole
 * SESSION 18: OFFLINE-FIRST — localStorage cache
 *
 *   Problem solved:
 *     When offline, Supabase calls in loadOrganizations() fail.
 *     Without a fallback, currentOrg=null + orgId=null, breaking every page.
 *
 *   Solution:
 *     After every successful load, write org data to localStorage.
 *     On mount, seed state from localStorage BEFORE the Supabase fetch.
 *     If Supabase fetch fails (offline), the seeded state is still valid.
 *     When back online, the fresh fetch overwrites the cache transparently.
 *
 *   Cache keys (localStorage):
 *     wl_cached_orgs         JSON array of org objects
 *     wl_cached_user_role    string — user's role in the active org
 *     wl_active_org_id       UUID — previously selected org (already existed)
 *     wl_cached_profile_org  JSON — user's org membership record
 *
 * @module context/OrganizationContext
 * @created February 20, 2026 - Session 9
 * @updated February 21, 2026 - Session 11: userOrgRole
 * @updated March 4, 2026    - Session 18: offline localStorage cache
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase/client';

// ── Cache helpers ─────────────────────────────────────────────────────────
// Small, synchronous reads from localStorage.
// Wrapped in try-catch: private/incognito mode can throw on localStorage access.

const CACHE_KEYS = {
  ORGS:       'wl_cached_orgs',
  USER_ROLE:  'wl_cached_user_role',
  ACTIVE_ORG: 'wl_active_org_id'
};

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; 
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private mode — ignore */ }
}

function clearOrgCache() {
  try {
    [CACHE_KEYS.ORGS, CACHE_KEYS.USER_ROLE].forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────

const OrganizationContext = createContext(null);

export function OrganizationProvider({ children }) {
  const { user, profile, loading: authLoading } = useAuth();

  // ── SESSION 18: Seed state from cache synchronously before any fetch ──
  // This means the app has org data available IMMEDIATELY on mount,
  // even before the Supabase call completes (or if it fails offline).
  const cachedOrgs = readCache(CACHE_KEYS.ORGS) || [];
  const savedOrgId = localStorage.getItem(CACHE_KEYS.ACTIVE_ORG);
  const cachedActiveOrg = savedOrgId
    ? cachedOrgs.find(o => o.id === savedOrgId) || cachedOrgs[0] || null
    : cachedOrgs[0] || null;

  const [allOrgs, setAllOrgs]         = useState(cachedOrgs);
  const [currentOrg, setCurrentOrg]   = useState(cachedActiveOrg);
  const [userOrgRole, setUserOrgRole] = useState(readCache(CACHE_KEYS.USER_ROLE));
  const [loading, setLoading]         = useState(true);

  // ─────────────────────────────────────────────────────────
  // Derived: Is this user Bina Jaya platform staff?
  // ─────────────────────────────────────────────────────────
  const isBinaJayaStaff = !!(
    profile?.global_role === 'super_admin' ||
    profile?.global_role === 'bina_jaya_staff'
  );

  const orgId = currentOrg?.id ?? null;

  // ─────────────────────────────────────────────────────────
  // Load organizations (runs when auth settles)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      setAllOrgs([]);
      setCurrentOrg(null);
      setUserOrgRole(null);
      setLoading(false);
      clearOrgCache();
      return;
    }
    loadOrganizations();
  }, [authLoading, user, profile?.global_role]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      let orgs = [];

      if (isBinaJayaStaff) {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, slug, subscription_tier, settings')
          .is('deleted_at', null)
          .order('name');

        if (error) {
          throw error;
        }
        orgs = data || [];
      } else {
        const { data, error } = await supabase
          .from('org_members')
          .select(`
            role,
            organization:organizations(id, name, slug, subscription_tier, settings)
          `)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .is('organizations.deleted_at', null);

        if (error) {
          throw error;
        }
        orgs = (data || [])
          .filter(m => m.organization)
          .map(m => m.organization);
      }

      // ── Persist to cache for offline use ──
      writeCache(CACHE_KEYS.ORGS, orgs);

      setAllOrgs(orgs);

      // Restore previously selected org, or default to first
      const savedId  = localStorage.getItem(CACHE_KEYS.ACTIVE_ORG);
      const savedOrg = savedId ? orgs.find(o => o.id === savedId) : null;
      const active   = savedOrg || orgs[0] || null;
      setCurrentOrg(active);

      console.log('✅ OrganizationContext: Loaded', orgs.length, 'orgs. Active:', active?.name);
    } catch (error) {
      // ── OFFLINE FALLBACK ──────────────────────────────────────────────
      // Supabase unreachable. State was already seeded from cache in useState()
      // above, so currentOrg and allOrgs are still valid from the previous session.
      // Just log and continue — don't overwrite the seeded state.
      console.warn('⚠️ OrganizationContext: Could not load from Supabase (offline?)', error.message);
      console.log('📱 OrganizationContext: Using cached org data:', allOrgs.length, 'orgs');
      // Don't setAllOrgs([]) here — keep the cached values that were seeded in useState
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Fetch userOrgRole whenever currentOrg changes
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchUserOrgRole();
  }, [currentOrg?.id, user?.id, profile?.global_role]);

  const fetchUserOrgRole = useCallback(async () => {
    if (!user || !currentOrg) {
      setUserOrgRole(null);
      return;
    }

    // BJ staff: their "role" is their global_role
    if (isBinaJayaStaff) {
      const role = profile.global_role;
      setUserOrgRole(role);
      writeCache(CACHE_KEYS.USER_ROLE, role);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('org_members')
        .select('role')
        .eq('organization_id', currentOrg.id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.warn('⚠️ No org_members row found for user in org:', currentOrg.name);
        // Don't clear cached role — keep the cached value if offline
        const cachedRole = readCache(CACHE_KEYS.USER_ROLE);
        if (cachedRole) {
          console.log('📱 Using cached userOrgRole:', cachedRole);
          setUserOrgRole(cachedRole);
        } else {
          setUserOrgRole(null);
        }
      } else {
        setUserOrgRole(data.role);
        writeCache(CACHE_KEYS.USER_ROLE, data.role);
        console.log('✅ userOrgRole:', data.role, 'in', currentOrg.name);
      }
    } catch (error) {
      // Offline — use cached role
      const cachedRole = readCache(CACHE_KEYS.USER_ROLE);
      console.warn('⚠️ fetchUserOrgRole offline, using cache:', cachedRole);
      if (cachedRole) {
        setUserOrgRole(cachedRole);
      }
    }
  }, [currentOrg?.id, user?.id, isBinaJayaStaff, profile?.global_role]);

  // ─────────────────────────────────────────────────────────
  // Switch organization (BJ staff only)
  // ─────────────────────────────────────────────────────────
  const switchOrganization = useCallback((orgIdToSwitch) => {
    const org = allOrgs.find(o => o.id === orgIdToSwitch);
    if (!org) {
      console.warn('⚠️ switchOrganization: org not found:', orgIdToSwitch);
      return;
    }
    setCurrentOrg(org);
    localStorage.setItem(CACHE_KEYS.ACTIVE_ORG, org.id);
    console.log('🔄 Switched to org:', org.name);
  }, [allOrgs]);

  // Clear org cache on logout
  useEffect(() => {
    if (!user) {
      localStorage.removeItem(CACHE_KEYS.ACTIVE_ORG);
      clearOrgCache();
    }
  }, [user]);

  // ─────────────────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────────────────
  const value = {
    allOrgs,
    currentOrg,
    loading,
    orgId,
    isBinaJayaStaff,
    userOrgRole,
    switchOrganization
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}

export default OrganizationContext;
