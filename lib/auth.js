// Mock Authentication System for FunnyRent 2.1
// This provides structure for future real auth implementation

import { v4 as uuidv4 } from 'uuid'

// Generate unique referral code
export function generateReferralCode() {
  const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `FR${randomNum}`
}

// Mock user session
export function createMockSession(userData) {
  return {
    user: {
      id: userData.id || uuidv4(),
      email: userData.email,
      role: userData.role || 'RENTER',
      referralCode: userData.referralCode || generateReferralCode(),
      preferredCurrency: userData.preferredCurrency || 'THB',
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  }
}

// Mock authentication check
export async function getMockUser(email) {
  // In real implementation, this would query the database
  // For now, return mock user
  return {
    id: uuidv4(),
    email: email,
    role: 'RENTER',
    referralCode: generateReferralCode(),
    preferredCurrency: 'THB',
    firstName: 'Test',
    lastName: 'User',
  }
}

// Role-based access control
export function hasRole(user, allowedRoles) {
  if (!user || !user.role) return false
  return allowedRoles.includes(user.role)
}

export function isPartner(user) {
  return hasRole(user, ['PARTNER', 'ADMIN'])
}

export function isAdmin(user) {
  return hasRole(user, ['ADMIN'])
}

// Mock Google OAuth flow
export function initGoogleAuth() {
  return {
    provider: 'google',
    clientId: process.env.GOOGLE_CLIENT_ID || 'placeholder',
    // In real implementation, this would redirect to Google OAuth
  }
}

// Mock Email/Password registration
export async function registerUser(email, password, referredBy = null) {
  // In real implementation, hash password and store in database
  const referralCode = generateReferralCode()
  
  return {
    id: uuidv4(),
    email,
    role: 'RENTER',
    referralCode,
    referredBy,
    verificationStatus: 'PENDING',
    balancePoints: 0,
    balanceUsdt: 0,
    preferredCurrency: 'THB',
    createdAt: new Date(),
  }
}

// Mock login
export async function loginUser(email, password) {
  // In real implementation, verify password against hashed version
  const user = await getMockUser(email)
  return createMockSession(user)
}