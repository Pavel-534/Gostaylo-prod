/**
 * Gostaylo - File Upload API
 * POST /api/v2/upload - Upload file to Supabase Storage
 * 
 * Supports: verification documents, avatars, etc.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_BUCKETS = ['verification_documents', 'listing-images', 'chat-attachments']

function publicUrlToProxyPath(publicUrl, supabaseProjectUrl) {
  if (!publicUrl || !supabaseProjectUrl) return publicUrl
  const base = supabaseProjectUrl.replace(/\/$/, '')
  const prefix = `${base}/storage/v1/object/public/`
  if (publicUrl.startsWith(prefix)) {
    return `/_storage/${publicUrl.slice(prefix.length)}`
  }
  return publicUrl
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function verifyAuth() {
  const cookieStore = cookies();
  const session = cookieStore.get('gostaylo_session');
  if (!session?.value) return null;
  
  try {
    return jwt.verify(session.value, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function POST(request) {
  const auth = verifyAuth();
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const bucket = formData.get('bucket') || 'verification_documents';
    const folder = formData.get('folder') || auth.userId;
    const objectPath = formData.get('objectPath');
    const upsert = formData.get('upsert') === 'true';

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ success: false, error: 'Bucket not allowed' }, { status: 400 });
    }
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        success: false, 
        error: 'Файл слишком большой (макс. 10MB)' 
      }, { status: 400 });
    }
    
    const isChatBucket = bucket === 'chat-attachments'
    const allowedTypes = isChatBucket
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: isChatBucket
            ? 'Для чата: JPG, PNG, WebP, GIF или PDF'
            : 'Неподдерживаемый формат файла. Используйте JPG, PNG, WebP или PDF',
        },
        { status: 400 }
      )
    }
    
    const ext = file.name.split('.').pop();
    const timestamp = Date.now();
    const filename = objectPath && typeof objectPath === 'string'
      ? objectPath.replace(/^\/+/, '')
      : `${folder}/${timestamp}.${ext}`;
    
    const supabase = getSupabase();
    
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert
      });
    
    if (error) {
      console.error('[UPLOAD] Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename);
    
    console.log(`[UPLOAD] File uploaded: ${filename}`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const proxyUrl = publicUrlToProxyPath(urlData.publicUrl, supabaseUrl)
    
    return NextResponse.json({
      success: true,
      path: data.path,
      url: proxyUrl,
      publicUrl: urlData.publicUrl,
      filename: filename
    });
    
  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/v2/upload — удалить объект из Storage (service role на сервере)
 */
export async function DELETE(request) {
  const auth = verifyAuth();
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bucket, path: objectPath } = body;
    if (!bucket || !objectPath || !ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ success: false, error: 'Invalid bucket or path' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.storage.from(bucket).remove([objectPath]);
    if (error) {
      console.error('[UPLOAD] Delete error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[UPLOAD] Delete:', e);
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 });
  }
}
