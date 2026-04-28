import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

export const alt = 'Ambassador invite'

export const size = { width: 1200, height: 630 }

export const contentType = 'image/png'

export default async function Image({ params }) {
  const id = params?.id != null ? String(params.id).trim() : ''
  let displayName = 'Partner'
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://gostaylo.ru'
  const base = String(raw).replace(/\/$/, '')

  if (id && base) {
    try {
      const res = await fetch(`${base}/api/v2/referral/landing-meta/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const j = await res.json().catch(() => ({}))
        if (j?.success && j?.data?.displayName) displayName = String(j.data.displayName).trim()
      }
    } catch {
      /* ignore */
    }
  }

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
          background: 'linear-gradient(135deg, #0f766e 0%, #0369a1 55%, #f59e0b 100%)',
          color: 'white',
          fontFamily: 'system-ui, Segoe UI, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            padding: '0 56px',
            textAlign: 'center',
            lineHeight: 1.15,
            textShadow: '0 2px 24px rgba(0,0,0,0.25)',
          }}
        >
          {displayName}
        </div>
        <div style={{ fontSize: 26, marginTop: 28, opacity: 0.92, fontWeight: 600 }}>
          Referral · Travel · Earn
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
