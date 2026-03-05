/**
 * Gostaylo - Supabase Auth Client
 * Real authentication using Supabase Auth
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';

// Client-side Supabase instance with auth
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

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
    
    if (!response.ok) {
      console.error('[AUTH] Login API returned:', response.status, response.statusText);
      const text = await response.text();
      console.error('[AUTH] Response body:', text.substring(0, 200));
      return { success: false, error: `Server error: ${response.status}` };
    }
    
    const result = await response.json();
    
    if (!result.success) {
      return { success: false, error: result.error };
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
    console.log('[AUTH] SignIn success for:', email);
    
    return { success: true, user: userInfo };
    
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
    // Get base URL for API calls (works on both client and server)
    const baseUrl = typeof window !== 'undefined' 
      ? '' 
      : (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '');
    
    console.log('[AUTH] SignUp attempt for:', email);
    
    // Call the API route which has admin privileges to create profile
    const response = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        password,
        firstName: name,
        role
      }),
    });
    
    if (!response.ok) {
      console.error('[AUTH] Register API returned:', response.status, response.statusText);
      const text = await response.text();
      console.error('[AUTH] Response body:', text.substring(0, 200));
      return { success: false, error: `Server error: ${response.status}` };
    }
    
    const result = await response.json();
    
    if (!result.success) {
      return { success: false, error: result.error };
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
      isVerified: result.user.isVerified,
      verificationStatus: result.user.verificationStatus
    };
    
    localStorage.setItem('gostaylo_user', JSON.stringify(userInfo));
    console.log('[AUTH] SignUp success for:', email);
    
    return { success: true, user: userInfo };
    
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
