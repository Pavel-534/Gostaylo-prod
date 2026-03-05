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
 * Sign in with email and password
 */
export async function signIn(email, password) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Get user profile from profiles table
  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  
  // Store user info in localStorage for backward compatibility
  const userInfo = {
    id: profile?.id || data.user.id,
    email: data.user.email,
    name: profile?.first_name || data.user.user_metadata?.name || email.split('@')[0],
    role: profile?.role || data.user.user_metadata?.role || 'RENTER',
    authId: data.user.id,
    session: data.session
  };
  
  localStorage.setItem('gostaylo_user', JSON.stringify(userInfo));
  localStorage.setItem('gostaylo_auth_token', data.session?.access_token || '');
  
  return { success: true, user: userInfo, session: data.session };
}

/**
 * Sign up new user
 */
export async function signUp({ email, password, name, role = 'RENTER' }) {
  const { data, error } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
        role: role
      }
    }
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Create profile in profiles table
  const profileId = `user-${Date.now().toString(36)}`;
  const { error: profileError } = await supabaseAuth
    .from('profiles')
    .insert({
      id: profileId,
      email: email,
      first_name: name,
      role: 'RENTER',
      auth_id: data.user?.id
    });
  
  if (profileError) {
    console.error('Profile creation error:', profileError);
  }
  
  return { success: true, user: data.user };
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
