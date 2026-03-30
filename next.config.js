/** @type {import('next').NextConfig} */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

function supabaseHostname() {
  if (!supabaseUrl) return null
  try {
    return new URL(supabaseUrl).hostname
  } catch {
    return null
  }
}

const host = supabaseHostname()

/** Next/Image: листинги и OG могут ссылаться на оба прод-домена */
const SITE_IMAGE_HOSTS = [
  'www.gostaylo.com',
  'gostaylo.com',
  'www.gostaylo.ru',
  'gostaylo.ru',
]

const nextConfig = {
  /**
   * CDN: префикс для /_next. Оставьте пустым за прокси Cloudflare→Vercel (иначе статика уйдёт на другой origin и обойдёт Worker).
   * Не задавайте NEXT_PUBLIC_ASSET_PREFIX на URL *.vercel.app для продакшена .ru
   */
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || undefined,

  /** Cloudflare / origin: единообразные пути со слешем в конце. */
  trailingSlash: true,
  /**
   * Иначе Next отдаёт 307 с `/api/...` на `/api/.../` — Telegram и другие POST-вебхуки
   * часто бьют в URL без слеша и не следуют редиректу для тела запроса.
   */
  skipTrailingSlashRedirect: true,

  /** Сброс кэша путей _next на новом деплое (Vercel / ручной билд). */
  generateBuildId: async () =>
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    `build-${Date.now()}`,

  images: {
    // Оптимизация Vercel / Next Image: WebP/AVIF, resize
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        pathname: '/**',
      },
      ...SITE_IMAGE_HOSTS.map((hostname) => ({
        protocol: 'https',
        hostname,
        pathname: '/**',
      })),
      ...(host
        ? [
            {
              protocol: 'https',
              hostname: host,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
    ],
  },

  /**
   * Явно разрешаем оба домена (на случай внешнего CSP-прокси).
   * 'self' покрывает текущий хост; домены — для кросс-ссылок и редиректов.
   */
  async headers() {
    const siteOrigins = SITE_IMAGE_HOSTS.map((h) => `https://${h}`).join(' ')
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com ${siteOrigins}`,
              `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com ${siteOrigins}`,
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: https://unpkg.com",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https:",
              "worker-src 'self' blob:",
              "manifest-src 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },

  async rewrites() {
    if (!supabaseUrl) return []
    const base = supabaseUrl.replace(/\/$/, '')
    return [
      {
        source: '/_db/:path*',
        destination: `${base}/rest/v1/:path*`,
      },
      {
        source: '/_storage/:path*',
        destination: `${base}/storage/v1/object/public/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
