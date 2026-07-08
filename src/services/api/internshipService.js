/**
 * AIntern - Internship Service
 *
 * CRUD for the intern's placement record (internships table) and the
 * intern profile (profiles table). Owner-based RLS means every query
 * is automatically scoped to the logged-in intern.
 *
 * @file src/services/api/internshipService.js
 * @created July 9, 2026 - Session 2
 */

import { supabase } from '../supabase/client';

class InternshipService {
  /**
   * Get the intern's current (most recent) internship, or null.
   */
  async getMyInternship() {
    try {
      const { data, error } = await supabase
        .from('internships')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('⚠️ getMyInternship error:', error.message);
        return { success: false, data: null, error: error.message };
      }
      return { success: true, data, error: null };
    } catch (error) {
      console.error('❌ getMyInternship exception:', error);
      return { success: false, data: null, error: error.message };
    }
  }

  /**
   * Create the internship (placement). user_id must be the logged-in
   * user (RLS enforces this).
   *
   * @param {Object} p - { company_name, department, supervisor_name,
   *   supervisor_email, start_date, end_date, evaluation_cadence_days,
   *   digest_mode, metadata }
   */
  async createInternship(p) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not logged in' };
      }

      const { data, error } = await supabase
        .from('internships')
        .insert({
          user_id: user.id,
          company_name: p.company_name,
          department: p.department || null,
          supervisor_name: p.supervisor_name,
          supervisor_email: p.supervisor_email,
          start_date: p.start_date,
          end_date: p.end_date,
          evaluation_cadence_days: p.evaluation_cadence_days ?? 7,
          digest_mode: p.digest_mode ?? 'daily',
          metadata: p.metadata ?? {},
        })
        .select()
        .single();

      if (error) {
        console.error('❌ createInternship error:', error);
        return { success: false, error: error.message };
      }
      return { success: true, data, error: null };
    } catch (error) {
      console.error('❌ createInternship exception:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update internship settings (cadence, digest mode, supervisor, metadata).
   */
  async updateInternship(id, updates) {
    try {
      const { data, error } = await supabase
        .from('internships')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ updateInternship error:', error);
        return { success: false, error: error.message };
      }
      return { success: true, data, error: null };
    } catch (error) {
      console.error('❌ updateInternship exception:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upsert the intern profile (name, phone, university, course).
   */
  async saveProfile(fields) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not logged in' };
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...fields }, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('❌ saveProfile error:', error);
        return { success: false, error: error.message };
      }
      return { success: true, data, error: null };
    } catch (error) {
      console.error('❌ saveProfile exception:', error);
      return { success: false, error: error.message };
    }
  }
}

export const internshipService = new InternshipService();
export default internshipService;
