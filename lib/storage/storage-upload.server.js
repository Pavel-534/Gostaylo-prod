/**
 * Server-side Storage helpers (service_role). Stage 95.0
 */

import { createClient } from '@supabase/supabase-js'
import { LEGACY_AVATAR_PREFIX, STORAGE_BUCKETS } from '@/lib/storage/storage-buckets'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function publicUrlToProxyPath(publicUrl, supabaseProjectUrl) {
  if (!publicUrl || !supabaseProjectUrl) return publicUrl
  const base = supabaseProjectUrl.replace(/\/$/, '')
  const prefix = `${base}/storage/v1/object/public/`
  if (publicUrl.startsWith(prefix)) {
    return `/_storage/${publicUrl.slice(prefix.length)}`
  }
  return publicUrl
}

/**
 * @param {{ bucket: string, path: string, buffer: Buffer, contentType: string, upsert?: boolean }} opts
 */
export async function uploadBufferToStorage({ bucket, path, buffer, contentType, upsert = false }) {
  const supabase = getAdminClient()
  if (!supabase) {
    return { success: false, error: 'Storage not configured' }
  }

  const objectPath = String(path || '').replace(/^\/+/, '')
  const { data, error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const proxyUrl = publicUrlToProxyPath(urlData.publicUrl, supabaseUrl)

  return {
    success: true,
    path: data.path,
    filename: objectPath,
    publicUrl: urlData.publicUrl,
    url: proxyUrl,
  }
}

/**
 * @param {string} bucket
 * @param {string} objectPath
 * @param {number} [expiresInSec]
 */
export async function createStorageSignedUrl(bucket, objectPath, expiresInSec = 600) {
  const supabase = getAdminClient()
  if (!supabase) {
    return { success: false, error: 'Storage not configured' }
  }
  const path = String(objectPath || '').replace(/^\/+/, '')
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec)
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true, signedUrl: data.signedUrl }
}

export async function removeStorageObject(bucket, objectPath) {
  const supabase = getAdminClient()
  if (!supabase) {
    return { success: false, error: 'Storage not configured' }
  }
  const { error } = await supabase.storage.from(bucket).remove([String(objectPath).replace(/^\/+/, '')])
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** Build canonical avatar object path for new uploads. */
export function buildAvatarObjectPath(profileId) {
  const id = String(profileId || '').replace(/\//g, '')
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  return `${id}/${ts}-${rand}.webp`
}

/** @deprecated Prefer bucket avatars; kept for reading legacy URLs only. */
export function buildLegacyAvatarFolder(profileId) {
  return `${LEGACY_AVATAR_PREFIX}${profileId}`
}
