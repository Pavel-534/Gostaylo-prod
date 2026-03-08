/**
 * Gostaylo - Supabase Auth Client
 * Real authentication using Supabase Auth
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[AUTH] Missing Supabase credentials');
}

// Client-side Supabase instance with auth
export const supabaseAuth = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

/**
 * Sign in with email and password - uses API route for proper profile lookup
 */
export async function signIn(email, password) {
  try {
    // Get base URL for API calls (works on both client and server)
    const baseUrl = typeof window !== 'undefined' 
      ? '' 
      : (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '');
    
    console.log('[AUTH] SignIn attempt for:', email);
    
    // Call the API route which has admin privileges to read profiles
    const response = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        password
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      console.error('[AUTH] Login failed:', result.error);
      return { success: false, error: result.error || 'Login failed' };
    }
    
    // Store user info in localStorage
    const userInfo = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name || result.user.firstName,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
      referralCode: result.user.referralCode,
      isVerified: result.user.isVerified,
      verificationStatus: result.user.verificationStatus,
      isModerator: result.user.isModerator
    };
    
    localStorage.setItem('gostaylo_user', JSON.stringify(userInfo));
    console.log(`[AUTH] SignIn success: ${email} (${result.user.role}) -> ${result.redirectTo}`);
    
    return { 
      success: true, 
      user: userInfo,
      redirectTo: result.redirectTo || '/'
    };
    
  } catch (error) {
    console.error('[AUTH] SignIn error:', error);
    return { success: false, error: error.message || 'Login failed' };
  }
}

/**
 * Sign up new user - uses API route for proper profile creation
 */
export async function signUp({ email, password, name, role = 'RENTER' }) {
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_BASE_URL || '');
    
    console.log('[AUTH] SignUp attempt for:', email);
    
    const response = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase(),
        password,
        firstName: name,
        role // Will be forced to RENTER by API
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      console.error('[AUTH] Register failed:', result.error);
      return { success: false, error: result.error || 'Registration failed' };
    }
    
    // Store user info in localStorage
    const userInfo = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.firstName || name,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
      referralCode: result.user.referralCode,
      isVerified: result.user.isVerified
    };
    
    localStorage.setItem('gostaylo_user', JSON.stringify(userInfo));
    console.log('[AUTH] SignUp success:', email);
    
    return { 
      success: true, 
      user: userInfo,
      redirectTo: result.redirectTo || '/'
    };
    
  } catch (error) {
    console.error('[AUTH] SignUp error:', error);
    return { success: false, error: error.message || 'Registration failed' };
  }
}

/**
 * Sign out
 */
export async function signOut() {
  await supabaseAuth.auth.signOut();
  localStorage.removeItem('gostaylo_user');
  localStorage.removeItem('gostaylo_auth_token');
  localStorage.removeItem('gostaylo_impersonating');
  localStorage.removeItem('gostaylo_original_user');
  return { success: true };
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session } } = await supabaseAuth.auth.getSession();
  return session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return null;
  
  // Get profile data
  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('*')
    .eq('email', user.email)
    .single();
  
  return {
    id: profile?.id || user.id,
    email: user.email,
    name: profile?.first_name || user.user_metadata?.name,
    role: profile?.role || user.user_metadata?.role || 'RENTER',
    authId: user.id
  };
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

/**
 * Update password
 */
export async function updatePassword(newPassword) {
  const { error } = await supabaseAuth.auth.updateUser({
    password: newPassword
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Impersonate user (Admin only)
 */
export function impersonateUser(targetUser) {
  // Store original admin user
  const currentUser = localStorage.getItem('gostaylo_user');
  if (currentUser) {
    const user = JSON.parse(currentUser);
    if (user.role === 'ADMIN') {
      localStorage.setItem('gostaylo_original_user', currentUser);
      localStorage.setItem('gostaylo_impersonating', 'true');
      localStorage.setItem('gostaylo_user', JSON.stringify(targetUser));
      return true;
    }
  }
  return false;
}

/**
 * Return from impersonation
 */
export function returnFromImpersonation() {
  const originalUser = localStorage.getItem('gostaylo_original_user');
  if (originalUser) {
    localStorage.setItem('gostaylo_user', originalUser);
    localStorage.removeItem('gostaylo_original_user');
    localStorage.removeItem('gostaylo_impersonating');
    return JSON.parse(originalUser);
  }
  return null;
}

/**
 * Check if currently impersonating
 */
export function isImpersonating() {
  return localStorage.getItem('gostaylo_impersonating') === 'true';
}
