/**
 * WorkLedger - Authentication Service
 *
 * Complete authentication service for user signup, login, logout,
 * password reset, profile management, and session handling.
 *
 * SESSION 19 UPDATE — Profile auto-creation on signup:
 *   After successful signUp(), we immediately INSERT into user_profiles.
 *   This is belt-and-suspenders alongside the database trigger
 *   (handle_new_user). Either path alone is sufficient; both together
 *   guarantee no user ever exists in auth.users without a profile row.
 *
 *   Why both:
 *     - DB trigger: reliable, fires even for admin-created users
 *     - App-level: fires immediately, allows us to store full_name
 *       from the signup form without waiting for trigger latency
 *
 * @module services/supabase/auth
 * @created January 29, 2026
 * @updated April 8, 2026 - Session 19: profile auto-creation on signup
 */

import { supabase } from './client';

export class AuthService {
  // ─────────────────────────────────────────────
  // SIGN UP
  // ─────────────────────────────────────────────

  /**
   * Register a new user.
   *
   * Flow:
   *   1. supabase.auth.signUp() → creates auth.users row
   *   2. DB trigger (handle_new_user) auto-creates user_profiles row
   *   3. We also upsert user_profiles here as belt-and-suspenders,
   *      ensuring full_name from the form is stored immediately.
   *
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {Object} params.metadata  — { full_name, phone, ... }
   * @returns {Promise<{success, user, error}>}
   */
  async signUp({ email, password, metadata = {} }) {
    try {
      console.log('🔐 Signing up user:', email);

      // ── Step 1: Create auth.users row ──────────────────────────────────
      // emailRedirectTo is set explicitly (self-configuring to whatever
      // origin the signup actually happened on, same pattern as
      // resetPassword() below) — WITHOUT this, Supabase falls back to the
      // "Site URL" configured in Dashboard > Authentication > URL
      // Configuration, which is almost certainly still the original
      // http://localhost:4900 from local dev and was never updated after
      // deploying to Vercel. This must ALSO be added to Dashboard >
      // Authentication > URL Configuration > Redirect URLs (an allow-list)
      // or Supabase will silently ignore it and fall back to the stale
      // Site URL anyway — this code change alone is not sufficient.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name:    metadata.full_name    || '',
            phone: metadata.phone || '',
            ...metadata
          }
        }
      });

      if (error) {
        console.error('❌ Signup error:', error);
        return { success: false, user: null, error: error.message };
      }

      const newUser = data.user;
      console.log('✅ Auth user created:', newUser?.email);

      // ── Step 2: Upsert user_profiles ───────────────────────────────────
      // The DB trigger (handle_new_user) fires on auth.users INSERT and
      // creates the profile automatically. We also upsert here so that:
      //   a) full_name from the form is guaranteed to be saved
      //   b) any trigger latency doesn't leave the user profileless
      //   c) this works even if the trigger hasn't been deployed yet
      if (newUser?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id:           newUser.id,
              full_name:    metadata.full_name    || '',
              phone: metadata.phone || '',
              created_at:   new Date().toISOString(),
              updated_at:   new Date().toISOString()
            },
            {
              onConflict:        'id',
              ignoreDuplicates:  false // Always update if row already exists
            }
          );

        if (profileError) {
          // Non-fatal — the trigger should have handled it.
          // The user is still created; profile may be created by trigger.
          console.warn('⚠️ Profile upsert after signup failed (non-fatal):', profileError.message);
        } else {
          console.log('✅ user_profiles row created/updated for:', newUser.email);
        }
      }

      return { success: true, user: newUser, error: null };
    } catch (error) {
      console.error('❌ Signup exception:', error);
      return {
        success: false,
        user: null,
        error: error.message || 'An unexpected error occurred during signup'
      };
    }
  }

  // ─────────────────────────────────────────────
  // SIGN IN
  // ─────────────────────────────────────────────

  async signIn({ email, password }) {
    try {
      console.log('🔐 Signing in user:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ Sign in error:', error);
        return { success: false, session: null, error: error.message };
      }

      console.log('✅ User signed in:', data.user?.email);

      // Belt-and-suspenders: ensure profile exists on login too.
      // Catches users who registered before the trigger was deployed.
      if (data.user?.id) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!existing) {
          console.log('⚠️ No profile found on login — creating now');
          await supabase
            .from('profiles')
            .insert({
              id:           data.user.id,
              full_name:    data.user.user_metadata?.full_name    || '',
              phone: data.user.user_metadata?.phone || '',
              created_at:   new Date().toISOString(),
              updated_at:   new Date().toISOString()
            })
            .select()
            .single();
        }
      }

      return { success: true, session: data.session, error: null };
    } catch (error) {
      console.error('❌ Sign in exception:', error);
      return { success: false, session: null, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // SIGN OUT
  // ─────────────────────────────────────────────

  async signOut() {
    try {
      console.log('🔐 Signing out user...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Sign out error:', error);
        return { success: false, error: error.message };
      }
      console.log('✅ User signed out');
      return { success: true };
    } catch (error) {
      console.error('❌ Sign out exception:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // SESSION
  // ─────────────────────────────────────────────

  async getCurrentSession() {
    try {
      console.log('🔍 getCurrentSession: Starting...');
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('❌ getCurrentSession error:', error);
        return null;
      }
      console.log('✅ getCurrentSession:', session ? 'Session found' : 'No session');
      return session;
    } catch (error) {
      console.error('❌ getCurrentSession exception:', error);
      return null;
    }
  }

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // PROFILE
  // ─────────────────────────────────────────────

  /**
   * Get user_profiles row for a given user ID.
   * Called by AuthContext after session is established.
   *
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, university, course, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('⚠️ getUserProfile error:', error.message);
        return null;
      }
      return data;
    } catch (error) {
      console.error('❌ getUserProfile exception:', error);
      return null;
    }
  }

  /**
   * Update the current user's profile.
   *
   * @param {string} userId
   * @param {Object} profileData  — { full_name, phone, avatar_url, preferences }
   * @returns {Promise<{success, data?, error?}>}
   */
  async updateProfile(userId, profileData) {
    try {
      console.log('🔐 Updating profile for:', userId);

      // Never allow global_role to be changed via this method
      const { global_role: _global_role, id: _id, created_at: _created_at, ...safeData } = profileData;

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...safeData, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Profile update error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Profile updated');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Profile update exception:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // PASSWORD
  // ─────────────────────────────────────────────

  async resetPassword(email) {
    try {
      console.log('🔐 Requesting password reset:', email);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updatePassword(newPassword) {
    try {
      console.log('🔐 Updating password...');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export const authService = new AuthService();
export default authService;
