'use client'

import { forwardRef } from 'react'

/**
 * Stage 206 — 9:16 invite card for Stories (Telegram / Instagram).
 * Rendered at 360×640 CSS px and exported @3x → 1080×1920 PNG via html-to-image.
 * Inline colors (not Tailwind tokens) so the PNG export is pixel-stable.
 */
export const ReferralStoryInviteCard = forwardRef(function ReferralStoryInviteCard(
  { brand, headline, giftAmount, giftSuffix, categories, qrDataUrl, code, codeLabel, linkCaption, scanHint, displayName, className = '', style },
  ref,
) {
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
        fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(165deg, #0F172A 0%, #004d4d 45%, #006666 75%, #0D9488 100%)',
        ...style,
      }}
    >
      {/* decorative glow rings */}
      <div style={{ position: 'absolute', top: -120, right: -110, width: 300, height: 300, borderRadius: 9999, background: 'radial-gradient(circle, rgba(45,212,191,0.45) 0%, rgba(45,212,191,0) 70%)' }} />
      <div style={{ position: 'absolute', bottom: -140, left: -120, width: 320, height: 320, borderRadius: 9999, background: 'radial-gradient(circle, rgba(13,148,136,0.55) 0%, rgba(13,148,136,0) 70%)' }} />
      <div style={{ position: 'absolute', top: 70, left: -60, width: 180, height: 180, borderRadius: 9999, border: '1px solid rgba(255,255,255,0.08)' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginTop: 34 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand vector, inlined by html-to-image */}
        <img src="/brand/airento-mark-light.svg" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{brand}</span>
      </div>

      <div style={{ position: 'relative', marginTop: 26, padding: '0 28px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>{headline}</p>
        {giftAmount ? (
          <p style={{ margin: '6px 0 0', fontSize: 50, lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.02em', color: '#5EEAD4' }}>
            {giftAmount}
          </p>
        ) : null}
        <p style={{ margin: '8px 0 0', fontSize: 20, lineHeight: 1.25, fontWeight: 700 }}>{giftSuffix}</p>
        <p style={{ margin: '12px 0 0', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.65)' }}>{categories}</p>
      </div>

      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          marginBottom: 30,
          width: 260,
          borderRadius: 28,
          background: '#ffffff',
          padding: '18px 18px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL QR
          <img src={qrDataUrl} alt="" width={190} height={190} style={{ width: 190, height: 190, display: 'block' }} />
        ) : (
          <div style={{ width: 190, height: 190, borderRadius: 12, background: '#f1f5f9' }} />
        )}
        {code ? (
          <div style={{ marginTop: 10, padding: '6px 14px', borderRadius: 9999, background: '#e6f4f3', color: '#006666', fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>
            {codeLabel} {code}
          </div>
        ) : null}
        <p style={{ margin: '8px 0 0', fontSize: 11, fontWeight: 500, color: '#64748b', textAlign: 'center', overflowWrap: 'anywhere' }}>{linkCaption}</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 26, textAlign: 'center', padding: '0 24px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{scanHint}</p>
        {displayName ? (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{displayName}</p>
        ) : null}
      </div>
    </div>
  )
})

export default ReferralStoryInviteCard
