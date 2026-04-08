'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'

function getFirebaseConfig() {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT || ''
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ''
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || ''
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''

  if (!projectId || !apiKey || !messagingSenderId || !appId) return null
  return {
    apiKey,
    authDomain: authDomain || `${projectId}.firebaseapp.com`,
    projectId,
    messagingSenderId,
    appId,
  }
}

export function getFirebaseAppSafe() {
  const cfg = getFirebaseConfig()
  if (!cfg) return null
  return getApps().length ? getApp() : initializeApp(cfg)
}

export function getFirebaseVapidKey() {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''
}
