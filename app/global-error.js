'use client'

/**
 * Stage 200.75 — root layout failure catch-all (replaces root layout).
 * Self-contained: no providers / useI18n.
 */

import { useEffect } from 'react'
import { getSiteDisplayName } from '@/lib/site-url'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  const brand = getSiteDisplayName()
  const lang =
    typeof navigator !== 'undefined' && String(navigator.language || '').toLowerCase().startsWith('ru')
      ? 'ru'
      : 'en'
  const copy =
    lang === 'ru'
      ? {
          title: 'Что-то пошло не так',
          body: 'Не удалось загрузить приложение. Попробуйте обновить страницу.',
          retry: 'Попробовать снова',
          home: 'На главную',
        }
      : {
          title: 'Something went wrong',
          body: 'The app could not load. Please try refreshing the page.',
          retry: 'Try again',
          home: 'Home',
        }

  return (
    <html lang={lang}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: 16,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            background: '#fff',
            padding: 32,
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#0d9488' }}>
            {brand}
          </p>
          <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 600 }}>{copy.title}</h1>
          <p style={{ margin: '0 0 24px', fontSize: 14, lineHeight: 1.55, color: '#475569' }}>
            {copy.body}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 44,
                border: 'none',
                borderRadius: 10,
                background: '#0d9488',
                color: '#fff',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              {copy.retry}
            </button>
            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 15,
              }}
            >
              {copy.home}
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
