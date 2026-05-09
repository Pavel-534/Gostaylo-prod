import { telegramEnv } from './env.js'
import { publicSupabaseUrlToProxyPath } from './storage-proxy.js'
import { compressImageBufferTelegramListing } from '@/lib/services/media/media-upload.service'

/** Telegram listing photo ingest — SSOT: `listing_photo` (sharp WebP на сервере). */
export async function compressImage(inputBuffer) {
  return compressImageBufferTelegramListing(inputBuffer)
}

export async function createStorageBucket() {
  const { supabaseUrl, serviceKey, storageBucket } = telegramEnv()
  if (!supabaseUrl || !serviceKey) return
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: storageBucket,
        name: storageBucket,
        public: true,
        file_size_limit: 10485760,
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      }),
    })

    if (res.ok) {
      console.log('[STORAGE] Bucket created successfully')
    } else {
      const error = await res.text()
      console.log('[STORAGE] Bucket creation response:', error)
    }
  } catch (e) {
    console.error('[STORAGE] Bucket creation error:', e)
  }
}

/**
 * Download Telegram file → compress → upload to Supabase Storage
 */
export async function uploadPhotoToStorage(fileId, listingId) {
  const { botToken, supabaseUrl, serviceKey, storageBucket } = telegramEnv()
  try {
    console.log(`[STORAGE] Starting upload for fileId: ${fileId}, listingId: ${listingId}`)

    if (!supabaseUrl || !serviceKey) {
      console.error('[STORAGE] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return null
    }

    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`)
    const fileData = await fileRes.json()

    console.log(`[STORAGE] Telegram getFile response:`, JSON.stringify(fileData))

    if (!fileData.ok || !fileData.result?.file_path) {
      console.error('[STORAGE] Failed to get file path from Telegram:', fileData.description || 'unknown')
      return null
    }

    const telegramFileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
    console.log(`[STORAGE] Downloading from: ${telegramFileUrl.replace(botToken, 'BOT_TOKEN')}`)

    const downloadRes = await fetch(telegramFileUrl)
    if (!downloadRes.ok) {
      console.error(`[STORAGE] Failed to download from Telegram: ${downloadRes.status} ${downloadRes.statusText}`)
      return null
    }

    const rawBuffer = await downloadRes.arrayBuffer()
    console.log(`[STORAGE] Downloaded ${(rawBuffer.byteLength / 1024).toFixed(1)}KB`)

    const compressedBuffer = await compressImage(rawBuffer)

    const fileName = `${listingId}/${Date.now()}.webp`
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${storageBucket}/${fileName}`
    console.log(`[STORAGE] Uploading to: ${uploadUrl}`)

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'image/webp',
        'x-upsert': 'true',
      },
      body: compressedBuffer,
    })

    const uploadResponseText = await uploadRes.text()
    console.log(`[STORAGE] Upload response: ${uploadRes.status} - ${uploadResponseText}`)

    if (!uploadRes.ok) {
      if (
        uploadResponseText.includes('not found') ||
        uploadResponseText.includes('Bucket') ||
        uploadResponseText.includes('bucket')
      ) {
        console.log('[STORAGE] Bucket may not exist, attempting to create...')
        await createStorageBucket()

        const retryRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'image/webp',
            'x-upsert': 'true',
          },
          body: compressedBuffer,
        })

        const retryText = await retryRes.text()
        console.log(`[STORAGE] Retry upload response: ${retryRes.status} - ${retryText}`)

        if (!retryRes.ok) {
          console.error('[STORAGE] Retry upload failed')
          return null
        }
      } else {
        console.error('[STORAGE] Upload failed with error:', uploadResponseText)
        return null
      }
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${storageBucket}/${fileName}`
    const proxyPath = publicSupabaseUrlToProxyPath(supabaseUrl, publicUrl)
    console.log(`[STORAGE] SUCCESS! Stored path (via site proxy): ${proxyPath}`)
    return proxyPath
  } catch (e) {
    console.error('[STORAGE ERROR]', e.message, e.stack)
    return null
  }
}
