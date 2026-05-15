/**
 * GoStayLo - File Upload API
 * POST /api/v2/upload — Supabase Storage via service_role + server-side authZ (Stage 95.0)
 */

import { NextResponse } from 'next/server'
import { tryGetJwtSecret } from '@/lib/auth/jwt-secret'
import { getSessionPayload } from '@/lib/services/session-service'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import {
  resolveMediaProfileId,
  logMediaProfile,
  isRasterImageMime,
  processImageBufferToWebp,
  processImageMainAndThumb,
  shouldGenerateThumb,
  buildThumbStoragePath,
} from '@/lib/storage/image-processor.server'
import { UPLOAD_API_BUCKETS } from '@/lib/storage/storage-buckets'
import { validateStorageUpload } from '@/lib/storage/storage-validation'
import {
  resolveStorageObjectPath,
  assertStorageUploadAllowed,
  assertStorageDeleteAllowed,
} from '@/lib/storage/storage-authorization'
import {
  uploadBufferToStorage,
  removeStorageObject,
} from '@/lib/storage/storage-upload.server'

export const dynamic = 'force-dynamic'

function replacePathExtensionToWebp(storagePath) {
  const s = String(storagePath || '').replace(/^\/+/, '')
  if (!s) return s
  return s.replace(/\.[^./\\]+$/i, '') + '.webp'
}

export async function POST(request) {
  const jwtCheck = tryGetJwtSecret()
  if (!jwtCheck.ok) {
    return authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500)
  }
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }
  const auth = { userId: session.userId, role: session.role }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const bucket = String(formData.get('bucket') || 'verification_documents')
    const folder = formData.get('folder') || auth.userId
    const objectPathRaw = formData.get('objectPath')
    const upsert = formData.get('upsert') === 'true'
    const mediaProfileHint = String(formData.get('profile') || formData.get('mediaProfile') || '').trim()
    const profileId = resolveMediaProfileId(bucket, mediaProfileHint)
    if (profileId) logMediaProfile(profileId)

    if (!UPLOAD_API_BUCKETS.includes(bucket)) {
      return NextResponse.json({ success: false, error: 'Bucket not allowed' }, { status: 400 })
    }

    if (!file || typeof file.size !== 'number') {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    const ext = file.name?.split('.').pop() || 'bin'
    const timestamp = Date.now()
    let filename = resolveStorageObjectPath({
      objectPath: objectPathRaw && typeof objectPathRaw === 'string' ? objectPathRaw : null,
      folder: typeof folder === 'string' ? folder : String(folder),
      userId: auth.userId,
    })
    if (!filename) {
      filename = `${auth.userId}/${timestamp}.${ext}`
    } else if (!objectPathRaw) {
      filename = `${filename}/${timestamp}.${ext}`.replace(/\/+/g, '/')
    }

    const authz = await assertStorageUploadAllowed({
      bucket,
      objectPath: filename,
      userId: auth.userId,
      role: auth.role,
    })
    if (!authz.ok) {
      return NextResponse.json({ success: false, error: authz.error }, { status: authz.status || 403 })
    }

    const validation = await validateStorageUpload(bucket, {
      size: file.size,
      type: file.type,
      name: file.name,
    })
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
    }

    const type = (file.type || '').trim()
    const nameLower = String(file.name || '').toLowerCase()
    const looksLikeAudio =
      type.startsWith('audio/') || /\.(webm|ogg|oga|opus|mp3|m4a|wav|mp4|aac)$/i.test(nameLower)

    let contentType = type || (looksLikeAudio ? 'audio/webm' : 'application/octet-stream')
    const arrayBuffer = await file.arrayBuffer()
    let buffer = Buffer.from(arrayBuffer)

    const raster = isRasterImageMime(type)
    /** @type {Buffer | null} */
    let thumbBuffer = null
    let thumbPath = null

    if (raster) {
      if (!profileId) {
        return NextResponse.json(
          { success: false, error: 'Не задан медиа-профиль для изображения' },
          { status: 400 },
        )
      }
      filename = replacePathExtensionToWebp(filename)

      if (shouldGenerateThumb(profileId)) {
        const dual = await processImageMainAndThumb(buffer, profileId)
        if (!dual.ok) {
          return NextResponse.json(
            { success: false, error: dual.error || 'Не удалось обработать изображение' },
            { status: 422 },
          )
        }
        buffer = dual.main
        thumbBuffer = dual.thumb
        thumbPath = buildThumbStoragePath(filename)
      } else {
        const processed = await processImageBufferToWebp(buffer, profileId)
        if (!processed.ok) {
          return NextResponse.json(
            { success: false, error: processed.error || 'Не удалось обработать изображение' },
            { status: 422 },
          )
        }
        buffer = processed.buffer
      }
      contentType = 'image/webp'
    }

    const uploaded = await uploadBufferToStorage({
      bucket,
      path: filename,
      buffer,
      contentType,
      upsert,
    })

    if (!uploaded.success) {
      console.error('[UPLOAD] Error:', uploaded.error)
      return NextResponse.json({ success: false, error: uploaded.error }, { status: 500 })
    }

    let thumbUpload = null
    if (thumbBuffer && thumbPath) {
      thumbUpload = await uploadBufferToStorage({
        bucket,
        path: thumbPath,
        buffer: thumbBuffer,
        contentType: 'image/webp',
        upsert,
      })
      if (!thumbUpload.success) {
        console.warn('[UPLOAD] thumb upload failed (main kept):', thumbUpload.error)
        thumbUpload = null
      }
    }

    console.log(
      `[UPLOAD] File uploaded: ${filename}${raster ? ' (webp)' : ''}${thumbUpload?.path ? ` + thumb ${thumbUpload.path}` : ''}`,
    )

    return NextResponse.json({
      success: true,
      path: uploaded.path,
      url: uploaded.url,
      publicUrl: uploaded.publicUrl,
      filename: uploaded.filename,
      ...(thumbUpload
        ? {
            thumbPath: thumbUpload.path,
            thumbUrl: thumbUpload.url,
            thumbPublicUrl: thumbUpload.publicUrl,
          }
        : {}),
    })
  } catch (error) {
    console.error('[UPLOAD] Error:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(request) {
  const jwtCheck = tryGetJwtSecret()
  if (!jwtCheck.ok) {
    return authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500)
  }
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }

  try {
    const body = await request.json()
    const { bucket, path: objectPath } = body
    if (!bucket || !objectPath || !UPLOAD_API_BUCKETS.includes(bucket)) {
      return NextResponse.json({ success: false, error: 'Invalid bucket or path' }, { status: 400 })
    }

    const authz = await assertStorageDeleteAllowed({
      bucket,
      objectPath,
      userId: session.userId,
      role: session.role,
    })
    if (!authz.ok) {
      return NextResponse.json({ success: false, error: authz.error }, { status: authz.status || 403 })
    }

    const removed = await removeStorageObject(bucket, objectPath)
    if (!removed.success) {
      console.error('[UPLOAD] Delete error:', removed.error)
      return NextResponse.json({ success: false, error: removed.error }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[UPLOAD] Delete:', e)
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 })
  }
}
