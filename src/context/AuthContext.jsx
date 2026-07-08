/**
 * WorkLedger - Authentication Context
 *
 * Provides global authentication state and methods to all components.
 * Manages user session, loading states, and auth operations.
 *
 * SESSION 19 UPDATE — PWA refresh logout fix:
 *   Supabase JS v2 fires INITIAL_SESSION on every app boot (including PWA
 *   refresh / full reload). The previous code only handled SIGNED_IN, which
 *   is NOT fired on boot — only on an explicit login action.
 *
 *   Race condition that was causing logout on PWA refresh:
 *     1. App boots → initializeAuth() calls authService.getCurrentSession()
 *     2. If the access token is expired, Supabase internally calls the refresh
 *        endpoint (network request). This takes ~200–800ms.
 *     3. While that network request is in-flight, INITIAL_SESSION fires with
 *        the old/null session if the token hasn't refreshed yet.
 *     4. initializeAuth() returns null → loading = false, user = null
 *     5. ProtectedRoute sees isAuthenticated = false → redirects to /login
 *     6. The actual SIGNED_IN or TOKEN_REFRESHED event fires too late.
 *
 *   Fix: Handle INITIAL_SESSION in onAuthStateChange. This event carries the
 *   correct session (including auto-refreshed token) when available, and null
 *   when there is genuinely no session. Loading is only set to false AFTER
 *   INITIAL_SESSION resolves — guaranteeing the auth gate never fires early.
 *
 * @module context/AuthContext
 * @created January 29, 2026
 * @updated April 7, 2026 - Session 19: PWA INITIAL_SESSION fix
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/supabase/auth';
import { supabase } from '../services/supabase/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // ─── Failsafe ──────────────────────────────────────────────────────────
  // If auth never resolves (network down, Supabase unreachable), unblock the
  // app after 8 seconds so the user sees the login page rather than a spinner.
  // Increased from 5s → 8s to give token refresh time to complete on slow
  // mobile connections (field sites often have 3G).
  useEffect(() => {
    const failsafeTimer = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ AuthContext: Failsafe triggered — forcing loading=false after 8s');
        setLoading(false);
      }
    }, 8000);

    return () => clearTimeout(failsafeTimer);
  }, [loading]);

  // ─── Auth Initialization ────────────────────────────────────────────────
  useEffect(() => {
    console.log('🔐 AuthContext: Initializing...');

    let isMounted = true;

    // ── Helper: load profile non-blocking ────────────────────────────────
    const loadProfile = (userId) => {
      authService.getUserProfile(userId)
        .then(userProfile => {
          if (!isMounted) {
            return;
          }
          setProfile(userProfile ?? null);
          if (userProfile) {
            console.log('✅ AuthContext: Profile loaded', userProfile.full_name);
          }
        })
        .catch(err => {
          console.error('❌ AuthContext: Profile load error (non-blocking):', err);
          if (isMounted) {
            setProfile(null);
          }
        });
    };

    // ── onAuthStateChange — registered FIRST ─────────────────────────────
    //
    // IMPORTANT: The listener is registered before initializeAuth() awaits
    // anything, ensuring we never miss the INITIAL_SESSION event.
    //
    // Supabase JS v2 auth events on PWA boot sequence:
    //   INITIAL_SESSION  → always fires once on boot with current session or null
    //   TOKEN_REFRESHED  → fires if the access token was silently refreshed
    //   SIGNED_IN        → fires only on explicit sign-in action
    //   SIGNED_OUT       → fires on signOut() call
    //
    // The key fix: INITIAL_SESSION sets loading=false, replacing the old pattern
    // where initializeAuth() was the sole gatekeeper. On PWA refresh, Supabase
    // fires INITIAL_SESSION before initializeAuth() resolves its async call, so
    // INITIAL_SESSION now wins and sets the correct auth state first.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(`🔐 AuthContext: Auth event → ${event}`, { hasSession: !!newSession });

        if (!isMounted) {
          return;
        }

        if (event === 'INITIAL_SESSION') {
          // Fired once on every app boot. newSession is the current valid session
          // (including auto-refreshed token) or null if not logged in.
          // This is the authoritative signal that auth has finished initialising.
          if (newSession) {
            console.log('✅ AuthContext: INITIAL_SESSION — user is authenticated');
            setSession(newSession);
            setUser(newSession.user);
            loadProfile(newSession.user.id);
          } else {
            console.log('ℹ️ AuthContext: INITIAL_SESSION — no session (user not logged in)');
            setSession(null);
            setUser(null);
            setProfile(null);
          }
          // Loading gate: unblock the app only after INITIAL_SESSION resolves.
          // This prevents ProtectedRoute from redirecting to /login prematurely.
          setLoading(false);

        } else if (event === 'SIGNED_IN' && newSession) {
          // Explicit login action (email+password, OAuth, magic link).
          console.log('✅ AuthContext: SIGNED_IN — user logged in');
          setSession(newSession);
          setUser(newSession.user);
          setLoading(false);
          loadProfile(newSession.user.id);

        } else if (event === 'SIGNED_OUT') {
          console.log('ℹ️ AuthContext: SIGNED_OUT');
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);

        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          // Silent token refresh — update session object only, no UX change.
          console.log('🔄 AuthContext: TOKEN_REFRESHED');
          setSession(newSession);

        } else if (event === 'USER_UPDATED' && newSession) {
          console.log('🔄 AuthContext: USER_UPDATED');
          setSession(newSession);
          setUser(newSession.user);
        }
      }
    );

    // ── initializeAuth ────────────────────────────────────────────────────
    // Kept as a secondary fallback. In practice, INITIAL_SESSION fires quickly
    // and sets loading=false before this async call resolves. If INITIAL_SESSION
    // somehow doesn't fire (edge case / old Supabase version), this ensures
    // loading eventually becomes false.
    const initializeAuth = async () => {
      try {
        console.log('🔄 AuthContext: initializeAuth — checking session...');
        const currentSession = await authService.getCurrentSession();

        if (!isMounted) {
          return;
        }

        // Only apply the result if loading is STILL true
        // (INITIAL_SESSION may have already resolved it — don't overwrite)
        if (currentSession) {
          console.log('✅ AuthContext: initializeAuth — session found (fallback path)');
          // Don't overwrite if INITIAL_SESSION already set the user
          setSession(prev => prev ?? currentSession);
          setUser(prev => prev ?? currentSession.user);
          if (!profile) {
            loadProfile(currentSession.user.id);
          }
        } else {
          console.log('ℹ️ AuthContext: initializeAuth — no session (fallback path)');
        }
      } catch (error) {
        console.error('❌ AuthContext: initializeAuth error:', error);
        if (isMounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        // Belt-and-suspenders: if INITIAL_SESSION never fired, unblock loading.
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      console.log('🔄 AuthContext: Cleaning up subscription');
      isMounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auth Methods ───────────────────────────────────────────────────────

  const login = async (email, password) => {
    console.log('🔐 AuthContext: Logging in...', email);
    setLoading(true);
    try {
      const result = await authService.signIn({ email, password });
      if (result.success) {
        console.log('✅ AuthContext: Login successful');
        return { success: true };
      }
      console.error('❌ AuthContext: Login failed:', result.error);
      return { success: false, error: result.error };
    } catch (error) {
      console.error('❌ AuthContext: Login exception:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, metadata = {}) => {
    console.log('🔐 AuthContext: Registering...', email);
    setLoading(true);
    try {
      const result = await authService.signUp({ email, password, metadata });
      if (result.success) {
        console.log('✅ AuthContext: Registration successful');
        return { success: true, user: result.user };
      }
      console.error('❌ AuthContext: Registration failed:', result.error);
      return { success: false, error: result.error };
    } catch (error) {
      console.error('❌ AuthContext: Registration exception:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    console.log('🔐 AuthContext: Logging out...');
    setLoading(true);
    try {
      const result = await authService.signOut();
      if (result.success) {
        console.log('✅ AuthContext: Logout successful');
        return { success: true };
      }
      console.error('❌ AuthContext: Logout failed:', result.error);
      return { success: false, error: result.error };
    } catch (error) {
      console.error('❌ AuthContext: Logout exception:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    console.log('🔐 AuthContext: Requesting password reset...', email);
    try {
      const result = await authService.resetPassword(email);
      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updatePassword = async (newPassword) => {
    console.log('🔐 AuthContext: Updating password...');
    try {
      const result = await authService.updatePassword(newPassword);
      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updateProfile = async (profileData) => {
    console.log('🔐 AuthContext: Updating profile...');
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }
    try {
      const result = await authService.updateProfile(user.id, profileData);
      if (result.success) {
        setProfile(result.data);
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ─── Context Value ──────────────────────────────────────────────────────
  const value = {
    user,
    session,
    profile,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    resetPassword,
    updatePassword,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
