import { ImageResponse } from 'next/og'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'
import { getUIText } from '@/lib/translations'
import { resolveOgLocale } from '@/lib/referral/resolve-og-locale.js'
import { publicFileDataUri, ogFonts, OG_BG } from '@/lib/seo/og-brand-card'

export const runtime = 'nodejs'
export const alt = 'Airento — invite'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }) {
  const id = params?.id != null ? String(params.id).trim() : ''
  let displayName = 'Partner'
  const base = getPublicSiteUrl()
  const lang = await resolveOgLocale()
  const brand = getSiteDisplayName()
  const subtitle = getUIText('stage1322_ogSubtitle', lang).replace(/\{brand\}/g, brand)

  if (id && base) {
    try {
      const res = await fetch(`${base}/api/v2/referral/landing-meta/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const j = await res.json().catch(() => ({}))
        if (j?.success && j?.data?.displayName) {
          displayName = String(j.data.displayName).trim()
        }
      }
    } catch {
      /* ignore */
    }
  }

  const inviteResolved = getUIText('stage1322_ogInviteLine', lang).replace(/\{name\}/g, displayName)
  const lockup = publicFileDataUri('brand/airento-lockup-onbg.png')

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: OG_BG,
          fontFamily: 'Noto, system-ui, sans-serif',
          padding: '64px',
        }}
      >
        {/* soft brand glow */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            width: 640,
            height: 340,
            background: 'radial-gradient(closest-side, rgba(13,148,136,0.42), rgba(13,148,136,0))',
            display: 'flex',
          }}
        />
        {lockup ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lockup} alt="" height={92} style={{ marginBottom: 40 }} />
        ) : (
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: '#fff', marginBottom: 40 }}>
            {brand}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            fontSize: 66,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.1,
            padding: '0 40px',
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            color: '#5eead4',
            marginTop: 22,
            fontWeight: 400,
            textAlign: 'center',
            padding: '0 48px',
          }}
        >
          {inviteResolved}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            color: '#94a3b8',
            marginTop: 'auto',
            fontWeight: 400,
          }}
        >
          {subtitle}
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() },
  )
}
