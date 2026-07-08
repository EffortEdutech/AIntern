/**
 * WorkLedger - Supabase Client
 * 
 * Initializes and exports the Supabase client for database and auth operations.
 * This is the single source of truth for Supabase connection.
 * 
 * @module services/supabase/client
 * @created January 29, 2026
 */

import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    '❌ VITE_SUPABASE_URL is not defined. Please check your .env.local file.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    '❌ VITE_SUPABASE_ANON_KEY is not defined. Please check your .env.local file.'
  );
}

/**
 * Supabase Client Configuration
 */
const supabaseConfig = {
  auth: {
    // Auto refresh token when it expires
    autoRefreshToken: true,
    
    // Persist session in localStorage
    persistSession: true,
    
    // Detect session from URL (for email confirmations, password resets)
    detectSessionInUrl: true,
    
    // Storage key for session
    storageKey: 'workledger-auth',
    
    // Storage type
    storage: window.localStorage
  },
  
  db: {
    // Schema to use (default: public)
    schema: 'public'
  },
  
  global: {
    headers: {
      'x-application-name': 'WorkLedger',
      'x-application-version': import.meta.env.VITE_APP_VERSION || '1.0.0'
    }
  }
};

/**
 * Supabase Client Instance
 * 
 * Use this client for all database and auth operations:
 * - Authentication: supabase.auth.*
 * - Database: supabase.from('table_name').*
 * - Storage: supabase.storage.*
 * - Functions: supabase.functions.*
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);

/**
 * Helper: Get current user
 * @returns {Promise<Object|null>} Current user or null
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Error getting current user:', error);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('❌ Exception getting current user:', error);
    return null;
  }
};

/**
 * Helper: Get current session
 * @returns {Promise<Object|null>} Current session or null
 */
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error getting current session:', error);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('❌ Exception getting current session:', error);
    return null;
  }
};

/**
 * Helper: Check if user is authenticated
 * @returns {Promise<boolean>} True if user is authenticated
 */
export const isAuthenticated = async () => {
  const session = await getCurrentSession();
  return session !== null;
};

/**
 * Helper: Subscribe to auth state changes
 * @param {Function} callback - Callback function (event, session) => {}
 * @returns {Object} Subscription object with unsubscribe method
 */
export const onAuthStateChange = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      console.log(`🔐 Auth event: ${event}`, session ? 'User logged in' : 'User logged out');
      callback(event, session);
    }
  );
  
  return subscription;
};

/**
 * Helper: Check database connection
 * @returns {Promise<boolean>} True if connection is healthy
 */
export const checkDatabaseConnection = async () => {
  try {
    const { error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Database connection check failed:', error);
      return false;
    }
    
    console.log('✅ Database connection is healthy');
    return true;
  } catch (error) {
    console.error('❌ Database connection exception:', error);
    return false;
  }
};

// Log initialization
console.log('✅ Supabase client initialized');
console.log(`📍 Supabase URL: ${supabaseUrl}`);

// Export default
export default supabase;
