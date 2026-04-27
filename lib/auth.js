/**
 * GoStayLo - Auth Client
 * Client-side auth functions using API routes
 */

/**
 * Sign in with email and password
 * @param {string} email 
 * @param {string} password 
 * @param {string} [redirectTo] - Optional custom redirect URL after login
 */
export async function signIn(email, password, redirectTo = null) {
  try {
    console.log('[AUTH] SignIn attempt for:', email);
    
    const response = await fetch('/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        password,
        redirectTo // Pass custom redirect if provided
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      return { 
        success: false, 
        error: result.error || 'Login failed',
        requiresVerification: result.requiresVerification || false,
        email: result.email
      };
    }
    
    // Store user in localStorage for quick access
    localStorage.setItem('gostaylo_user', JSON.stringify(result.user));
    console.log(`[AUTH] SignIn success: ${email} -> ${result.redirectTo}`);
    
    return { 
      success: true, 
      user: result.user,
      redirectTo: result.redirectTo || '/'
    };
    
  } catch (error) {
    console.error('[AUTH] SignIn error:', error);
    return { success: false, error: error.message || 'Login failed' };
  }
}

/**
 * Sign up new user
 */
export async function signUp({
  email,
  password,
  name,
  role = 'RENTER',
  referredBy = null,
  referralFingerprint = null,
}) {
  try {
    console.log('[AUTH] SignUp attempt for:', email);
    
    const response = await fetch('/api/v2/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        password,
        firstName: name?.trim(),
        role,
        referredBy: referredBy ? String(referredBy).trim().toUpperCase() : null,
        referralFingerprint: referralFingerprint ? String(referralFingerprint).trim() : null,
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Registration failed' };
    }
    
    console.log('[AUTH] SignUp success:', email);
    
    return { 
      success: true, 
      user: result.user,
      requiresVerification: result.requiresVerification || false,
      emailSent: result.emailSent || false,
      emailError: result.emailError
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
  try {
    await fetch('/api/v2/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    localStorage.removeItem('gostaylo_user');
    localStorage.removeItem('gostaylo_auth_token');
    
    return { success: true };
  } catch (error) {
    console.error('[AUTH] SignOut error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current user from session
 */
export async function getCurrentUser() {
  try {
    const response = await fetch('/api/v2/auth/me', {
      credentials: 'include'
    });
    
    const result = await response.json();
    
    if (result.success && result.user) {
      localStorage.setItem('gostaylo_user', JSON.stringify(result.user));
      return result.user;
    }
    
    return null;
  } catch (error) {
    console.error('[AUTH] getCurrentUser error:', error);
    return null;
  }
}

/**
 * Get user from localStorage (for quick UI updates)
 */
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('gostaylo_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Check if user is logged in
 */
export function isLoggedIn() {
  return !!getStoredUser();
}

/**
 * Check if user has specific role
 */
export function hasRole(role) {
  const user = getStoredUser();
  return user?.role === role;
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email) {
  try {
    const response = await fetch('/api/v2/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase().trim() })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}
