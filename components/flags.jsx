'use client'

import React from 'react'

function Svg({ children, title, ...props }) {
  return (
    <svg
      viewBox="0 0 24 16"
      width="24"
      height="16"
      role="img"
      aria-label={title}
      className="inline-block rounded-[3px] border border-slate-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]"
      {...props}
    >
      {children}
    </svg>
  )
}

export function Flag({ code, title }) {
  const c = (code || '').toLowerCase()
  const label = title || c.toUpperCase()

  if (c === 'ru') {
    return (
      <Svg title={label}>
        <rect width="24" height="16" fill="#ffffff" />
        <rect y="5.333" width="24" height="5.333" fill="#1c57a7" />
        <rect y="10.666" width="24" height="5.334" fill="#d52b1e" />
      </Svg>
    )
  }

  if (c === 'th') {
    return (
      <Svg title={label}>
        <rect width="24" height="16" fill="#a51931" />
        <rect y="3.2" width="24" height="9.6" fill="#ffffff" />
        <rect y="4.8" width="24" height="6.4" fill="#2d2a4a" />
      </Svg>
    )
  }

  if (c === 'cn' || c === 'zh') {
    return (
      <Svg title={label}>
        <rect width="24" height="16" fill="#de2910" />
        <circle cx="6" cy="5" r="2" fill="#ffde00" />
      </Svg>
    )
  }

  if (c === 'gb' || c === 'en') {
    // Simplified UK flag (clean at small sizes)
    return (
      <Svg title={label}>
        <rect width="24" height="16" fill="#012169" />
        <rect x="10.5" width="3" height="16" fill="#ffffff" />
        <rect y="6.5" width="24" height="3" fill="#ffffff" />
        <rect x="11" width="2" height="16" fill="#c8102e" />
        <rect y="7" width="24" height="2" fill="#c8102e" />
      </Svg>
    )
  }

  if (c === 'us') {
    return (
      <Svg title={label}>
        <rect width="24" height="16" fill="#ffffff" />
        {/* stripes */}
        <rect y="0" width="24" height="2" fill="#b22234" />
        <rect y="4" width="24" height="2" fill="#b22234" />
        <rect y="8" width="24" height="2" fill="#b22234" />
        <rect y="12" width="24" height="2" fill="#b22234" />
        {/* canton */}
        <rect width="10.5" height="8" fill="#3c3b6e" />
      </Svg>
    )
  }

  if (c === 'eu') {
    return (
      <Svg title={label}>
        <rect width="24" height="16" fill="#003399" />
        {/* simplified "stars" */}
        <circle cx="12" cy="8" r="2.4" fill="#ffcc00" opacity="0.9" />
      </Svg>
    )
  }

  // fallback
  return (
    <Svg title={label}>
      <rect width="24" height="16" fill="#e2e8f0" />
    </Svg>
  )
}

export function CurrencyFlag({ code }) {
  const c = (code || '').toUpperCase()

  if (c === 'USD') return <Flag code="us" title="USD" />
  if (c === 'GBP') return <Flag code="gb" title="GBP" />
  if (c === 'EUR') return <Flag code="eu" title="EUR" />
  if (c === 'THB') return <Flag code="th" title="THB" />
  if (c === 'RUB') return <Flag code="ru" title="RUB" />
  if (c === 'CNY') return <Flag code="cn" title="CNY" />

  return <Flag code="eu" title={c} />
}

