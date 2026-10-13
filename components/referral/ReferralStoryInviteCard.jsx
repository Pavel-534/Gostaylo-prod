'use client'

import { forwardRef } from 'react'

/**
 * Stage 206/207 — 9:16 invite card for Stories (Telegram / Instagram).
 * Rendered at 360×640 CSS px and exported @3x → 1080×1920 PNG via html-to-image.
 * Inline colors + inline SVG scenes so the PNG export is pixel-stable (no external images).
 */

export const STORY_THEMES = ['beach', 'city', 'sea']

function BeachScene() {
  return (
    <svg width="360" height="640" viewBox="0 0 360 640" style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <defs>
        <linearGradient id="bSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B4F6C" />
          <stop offset="0.45" stopColor="#F59E0B" />
          <stop offset="0.62" stopColor="#FDBA74" />
        </linearGradient>
        <linearGradient id="bSea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0EA5A4" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
      </defs>
      <rect width="360" height="640" fill="url(#bSky)" />
      <circle cx="250" cy="330" r="62" fill="#FDE68A" opacity="0.95" />
      <rect y="360" width="360" height="130" fill="url(#bSea)" />
      <path d="M0 395 Q45 385 90 395 T180 395 T270 395 T360 395" stroke="#99F6E4" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M0 430 Q45 420 90 430 T180 430 T270 430 T360 430" stroke="#99F6E4" strokeWidth="2" fill="none" opacity="0.4" />
      <path d="M0 470 Q90 440 180 465 T360 455 L360 640 L0 640 Z" fill="#FCD9A8" />
      <path d="M0 520 Q120 495 240 515 T360 505 L360 640 L0 640 Z" fill="#F8C98A" />
      {/* palm */}
      <path d="M62 520 Q72 420 98 350" stroke="#3F2A1D" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M98 350 Q60 330 22 352" stroke="#166534" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M98 350 Q130 318 170 334" stroke="#15803D" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M98 350 Q84 305 52 292" stroke="#14532D" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M98 350 Q122 300 152 296" stroke="#166534" strokeWidth="9" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function CityScene() {
  const towers = [
    [0, 330, 46], [40, 280, 38], [74, 350, 30], [100, 250, 44], [140, 310, 34],
    [170, 220, 40], [206, 300, 36], [238, 260, 42], [276, 340, 30], [302, 290, 58],
  ]
  return (
    <svg width="360" height="640" viewBox="0 0 360 640" style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <defs>
        <linearGradient id="cSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0F172A" />
          <stop offset="0.55" stopColor="#4C1D95" />
          <stop offset="0.8" stopColor="#DB2777" />
        </linearGradient>
      </defs>
      <rect width="360" height="640" fill="url(#cSky)" />
      {[[40, 60], [300, 90], [210, 40], [120, 120], [330, 180], [20, 200]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#ffffff" opacity="0.7" />
      ))}
      <circle cx="318" cy="300" r="30" fill="#FBCFE8" opacity="0.85" />
      {towers.map(([x, top, w]) => (
        <g key={x}>
          <rect x={x} y={top + 120} width={w} height={640} fill="#1E1B4B" />
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x={x + 6 + (i % 2) * (w / 2 - 4)} y={top + 136 + Math.floor(i / 2) * 22} width="6" height="9" fill="#FDE68A" opacity={i % 3 === 0 ? 0.25 : 0.8} />
          ))}
        </g>
      ))}
      <rect y="560" width="360" height="80" fill="#0F172A" />
    </svg>
  )
}

function SeaScene() {
  return (
    <svg width="360" height="640" viewBox="0 0 360 640" style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <defs>
        <linearGradient id="sSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0C4A6E" />
          <stop offset="0.5" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="sSea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0284C7" />
          <stop offset="1" stopColor="#082F49" />
        </linearGradient>
      </defs>
      <rect width="360" height="640" fill="url(#sSky)" />
      <circle cx="80" cy="250" r="40" fill="#FEF3C7" opacity="0.9" />
      <ellipse cx="250" cy="200" rx="50" ry="12" fill="#ffffff" opacity="0.35" />
      <ellipse cx="120" cy="160" rx="38" ry="9" fill="#ffffff" opacity="0.25" />
      <rect y="330" width="360" height="310" fill="url(#sSea)" />
      {/* sailboat — right edge so it peeks out beside the QR plate */}
      <g transform="translate(78 -10)">
      <path d="M220 330 L220 240 L270 322 Z" fill="#F8FAFC" />
      <path d="M216 330 L216 258 L186 322 Z" fill="#E2E8F0" />
      <path d="M180 332 L282 332 L268 348 L194 348 Z" fill="#7C2D12" />
      </g>
      {[372, 410, 452, 500, 556].map((y, i) => (
        <path key={y} d={`M0 ${y} Q45 ${y - 10} 90 ${y} T180 ${y} T270 ${y} T360 ${y}`} stroke="#7DD3FC" strokeWidth="2" fill="none" opacity={0.55 - i * 0.08} />
      ))}
    </svg>
  )
}

const SCENES = { beach: BeachScene, city: CityScene, sea: SeaScene }

export const ReferralStoryInviteCard = forwardRef(function ReferralStoryInviteCard(
  { theme = 'beach', brand, headline, giftAmount, giftSuffix, categories, qrDataUrl, code, codeLabel, linkCaption, scanHint, displayName, className = '', style },
  ref,
) {
  const Scene = SCENES[theme] || BeachScene
  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: 360,
        height: 640,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: '#ffffff',
        fontFamily: 'var(--font-sans), system-ui, -apple-system, sans-serif',
        background: '#0F172A',
        ...style,
      }}
    >
      <Scene />
      {/* readability veil: dark top for text, soft bottom for QR caption */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(15,23,42,0.35) 42%, rgba(15,23,42,0.05) 60%, rgba(15,23,42,0.55) 100%)' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginTop: 34 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand vector, inlined by html-to-image */}
        <img src="/brand/airento-mark-light.svg" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{brand}</span>
      </div>

      <div style={{ position: 'relative', marginTop: 24, padding: '0 28px', textAlign: 'center', textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{headline}</p>
        {giftAmount ? (
          <p style={{ margin: '6px 0 0', fontSize: 50, lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.02em', color: '#FDE68A' }}>
            {giftAmount}
          </p>
        ) : null}
        <p style={{ margin: '8px 0 0', fontSize: 20, lineHeight: 1.25, fontWeight: 700 }}>{giftSuffix}</p>
        <p style={{ margin: '12px 0 0', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.8)' }}>{categories}</p>
      </div>

      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          marginBottom: 26,
          width: 232,
          borderRadius: 28,
          background: '#ffffff',
          padding: '16px 16px 14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL QR
          <img src={qrDataUrl} alt="" width={168} height={168} style={{ width: 168, height: 168, display: 'block' }} />
        ) : (
          <div style={{ width: 168, height: 168, borderRadius: 12, background: '#f1f5f9' }} />
        )}
        {code ? (
          <div style={{ marginTop: 10, padding: '6px 14px', borderRadius: 9999, background: '#e6f4f3', color: '#006666', fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>
            {codeLabel} {code}
          </div>
        ) : null}
        <p style={{ margin: '8px 0 0', fontSize: 11, fontWeight: 500, color: '#64748b', textAlign: 'center', overflowWrap: 'anywhere' }}>{linkCaption}</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 24, textAlign: 'center', padding: '0 24px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{scanHint}</p>
        {displayName ? (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{displayName}</p>
        ) : null}
      </div>
    </div>
  )
})

export default ReferralStoryInviteCard
