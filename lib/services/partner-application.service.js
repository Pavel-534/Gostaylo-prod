/**
 * Partner application submission — single source of truth (Phase 1.8).
 * Used by POST /api/v2/partner/applications (canonical) and POST /api/v2/partner/apply (legacy alias).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import { sendToTopic } from '@/lib/telegram'
import { logPartnerKycE2eRunbook } from '@/lib/runbooks/partner-kyc-e2e-smoke'

const APP_URL = getPublicSiteUrl()

function isAllowedVerificationDocUrl(url) {
  const u = String(url || '').trim()
  if (u.length < 8) return false
  if (u.startsWith('/_storage/')) return true
  if (u.startsWith('https://') || u.startsWith('http://')) return true
  return false
}

export async function sendPartnerApplicationTelegram({ application, userEmail }) {
  const appId = application?.id
  const kycLine = appId
    ? `\n📎 <b>KYC:</b> только в админке → <a href="${APP_URL}/admin/partners/${appId}">карточка заявки</a>`
    : ''

  const message = [
    '🤝 <b>НОВАЯ ЗАЯВКА НА ПАРТНЁРСТВО</b>',
    '',
    `📧 <b>Email:</b> ${userEmail}`,
    `📞 <b>Телефон:</b> ${application.phone || '—'}`,
    `📝 <b>Опыт:</b> ${(application.experience || '—').substring(0, 200)}`,
    application.social_link ? `🔗 <b>Соцсети:</b> ${application.social_link}` : '',
    application.portfolio ? `📂 <b>Портфолио:</b> ${application.portfolio}` : '',
    kycLine,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `🔗 <a href="${APP_URL}/admin/partners">Заявки партнёров →</a>`,
    ` · <a href="${APP_URL}/admin/users">Пользователи →</a>`,
    '',
    '⏰ Рассмотреть в течение 24 часов',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await sendToTopic('NEW_PARTNERS', message, { disable_web_page_preview: true })
  if (!result?.ok) {
    console.warn('[PARTNER-APPLICATION] Telegram sendToTopic failed:', result?.description || result?.error)
    return false
  }
  return true
}

/**
 * Persist partner application + sync profile phone. No Telegram.
 * @returns {Promise<{ ok: true, application: object, user: object } | { ok: false, status: number, body: object }>}
 */
export async function submitPartnerApplicationCore({
  userId,
  phone,
  experience,
  socialLink,
  portfolio,
  verificationDocUrl,
}) {
  const docRaw = typeof verificationDocUrl === 'string' ? verificationDocUrl.trim() : ''
  if (!docRaw || !isAllowedVerificationDocUrl(docRaw)) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error:
          'Загрузите документ удостоверения личности (паспорт или ID). После загрузки отправьте заявку снова.',
      },
    }
  }

  if (!phone || !experience) {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: 'Missing required fields: phone, experience' },
    }
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .single()

  if (userError || !user) {
    return { ok: false, status: 404, body: { success: false, error: 'User not found' } }
  }

  if (user.role === 'PARTNER') {
    return { ok: false, status: 400, body: { success: false, error: 'User is already a partner' } }
  }

  let normalizedPortfolio = typeof portfolio === 'string' ? portfolio.trim() : ''
  normalizedPortfolio = normalizedPortfolio || null
  if (
    normalizedPortfolio &&
    !normalizedPortfolio.startsWith('http://') &&
    !normalizedPortfolio.startsWith('https://')
  ) {
    normalizedPortfolio = `https://${normalizedPortfolio}`
  }
  const social = typeof socialLink === 'string' ? socialLink.trim() : ''
  const socialNorm = social || null

  const { data: existingApp } = await supabaseAdmin
    .from('partner_applications')
    .select('id, status')
    .eq('user_id', userId)
    .maybeSingle()

  let application = null

  if (existingApp) {
    if (existingApp.status === 'PENDING') {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: 'You already have a pending application' },
      }
    }
    if (existingApp.status === 'APPROVED') {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error:
            'Заявка уже была одобрена. Если кабинет партнёра не открылся — напишите в поддержку.',
        },
      }
    }
    if (existingApp.status === 'REJECTED') {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('partner_applications')
        .update({
          phone,
          experience,
          social_link: socialNorm,
          portfolio: normalizedPortfolio,
          verification_doc_url: docRaw,
          status: 'PENDING',
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingApp.id)
        .select()
        .single()

      if (updateError || !updated) {
        console.error('[PARTNER-APPLICATION] Resubmit update error:', updateError)
        return {
          ok: false,
          status: 500,
          body: { success: false, error: 'Failed to submit application' },
        }
      }
      application = updated
    } else {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: 'Invalid application state' },
      }
    }
  }

  if (!application) {
    const { data: inserted, error: createError } = await supabaseAdmin
      .from('partner_applications')
      .insert({
        user_id: userId,
        phone,
        experience,
        social_link: socialNorm,
        portfolio: normalizedPortfolio,
        verification_doc_url: docRaw,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError || !inserted) {
      console.error('[PARTNER-APPLICATION] Create error:', createError)
      return {
        ok: false,
        status: 500,
        body: { success: false, error: 'Failed to submit application' },
      }
    }
    application = inserted
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (profileError) {
    console.error('[PARTNER-APPLICATION] Profile phone update error:', profileError)
  }

  return { ok: true, application, user }
}

/**
 * Unified POST handler for partner application routes.
 */
export async function handlePartnerApplicationPost(request) {
  const sessionUserId = await getUserIdFromSession()
  if (!sessionUserId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { phone, experience, socialLink, portfolio, verificationDocUrl, userId: bodyUserId } =
    body || {}

  if (bodyUserId && bodyUserId !== sessionUserId) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
  }

  const result = await submitPartnerApplicationCore({
    userId: sessionUserId,
    phone,
    experience,
    socialLink,
    portfolio,
    verificationDocUrl,
  })

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status })
  }

  const { application, user } = result

  await sendPartnerApplicationTelegram({ application, userEmail: user.email })

  console.log(`[PARTNER-APPLICATION] Submitted from ${user.email} (${sessionUserId})`)
  logPartnerKycE2eRunbook()

  return NextResponse.json({
    success: true,
    message: "Application submitted successfully! We'll review it within 24 hours.",
    data: {
      id: application.id,
      status: application.status,
      created_at: application.created_at,
    },
    redirectTo: '/partner-application-success',
  })
}

/**
 * PATCH /api/v2/partner/applications — attach or replace verification_doc_url for PENDING application only.
 */
export async function handlePartnerApplicationPatchKyc(request) {
  const sessionUserId = await getUserIdFromSession()
  if (!sessionUserId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const docRaw = typeof body?.verificationDocUrl === 'string' ? body.verificationDocUrl.trim() : ''
  if (!docRaw || !isAllowedVerificationDocUrl(docRaw)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Укажите корректный URL документа после загрузки (паспорт или ID).',
      },
      { status: 400 },
    )
  }

  const { data: app, error: selErr } = await supabaseAdmin
    .from('partner_applications')
    .select('id, status, user_id')
    .eq('user_id', sessionUserId)
    .maybeSingle()

  if (selErr) {
    console.error('[PARTNER-APPLICATION] PATCH select', selErr.message)
    return NextResponse.json({ success: false, error: selErr.message }, { status: 500 })
  }
  if (!app) {
    return NextResponse.json({ success: false, error: 'Заявка не найдена' }, { status: 404 })
  }
  if (app.status !== 'PENDING') {
    return NextResponse.json(
      {
        success: false,
        error: 'Документ можно прикрепить только к заявке на рассмотрении (PENDING).',
      },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const { error: upErr } = await supabaseAdmin
    .from('partner_applications')
    .update({
      verification_doc_url: docRaw,
      updated_at: now,
    })
    .eq('id', app.id)
    .eq('status', 'PENDING')

  if (upErr) {
    console.error('[PARTNER-APPLICATION] PATCH update', upErr.message)
    return NextResponse.json({ success: false, error: 'Не удалось сохранить документ' }, { status: 500 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', sessionUserId)
    .maybeSingle()

  const patchMsg = [
    '📎 <b>KYC к заявке (PENDING)</b>',
    '',
    `Пользователь: <code>${sessionUserId}</code>`,
    profile?.email ? `📧 ${profile.email}` : '',
    `<a href="${APP_URL}/admin/partners/${app.id}">Открыть заявку →</a>`,
  ]
    .filter(Boolean)
    .join('\n')

  const tg = await sendToTopic('NEW_PARTNERS', patchMsg, { disable_web_page_preview: true })
  if (!tg?.ok) {
    console.warn('[PARTNER-APPLICATION] PATCH Telegram:', tg?.description || tg?.error)
  }

  console.log(`[PARTNER-APPLICATION] PATCH KYC user=${sessionUserId} app=${app.id}`)

  return NextResponse.json({
    success: true,
    message: 'Документ сохранён в заявке',
    hasVerificationDoc: true,
  })
}
