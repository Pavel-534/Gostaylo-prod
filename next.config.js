/** @type {import('next').NextConfig} */
/**
 * Vercel production `npm install` may omit devDependencies, so @next/bundle-analyzer
 * is optional. Local `npm install` + `npm run analyze` still load the package.
 */
let withBundleAnalyzer = (config) => config
try {
  const createAnalyzer = require('@next/bundle-analyzer')
  withBundleAnalyzer = createAnalyzer({ enabled: process.env.ANALYZE === 'true' })
} catch {
  /* optional dev tool */
}

const supabasePublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServerUrl = process.env.SUPABASE_SERVER_URL || supabasePublicUrl

function supabaseHostname(url) {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

const publicSupabaseHost = supabaseHostname(supabasePublicUrl)
const serverSupabaseHost = supabaseHostname(supabaseServerUrl)

const { SITE_IMAGE_HOSTS } = require('./lib/site-url.cjs')

const PDF_TRACE_INCLUDES = [
  './lib/assets/fonts/partner-pdf/**/*',
  './node_modules/pdfkit/js/data/**/*',
]

const nextConfig = {
  /** Dev/build isolation: avoids .next race when local dev server is running during `next build`. */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

  /** pdfkit не должен попадать в webpack-chunk (иначе ENOENT Helvetica.afm на Vercel) */
  experimental: {
    /** Next 14: serverComponentsExternalPackages; Next 15+ — serverExternalPackages на верхнем уровне */
    serverComponentsExternalPackages: ['pdfkit'],
    /** Vercel: Noto + pdfkit/data (AFM) в serverless bundle */
    outputFileTracingIncludes: {
      '/api/admin/settings/legal/test-full-package': PDF_TRACE_INCLUDES,
      '/api/admin/settings/legal/export-zip': PDF_TRACE_INCLUDES,
      '/api/admin/settings/legal/pdf': PDF_TRACE_INCLUDES,
      '/api/admin/finances/prepare-pause': PDF_TRACE_INCLUDES,
      '/api/admin/smoke/financial-run': PDF_TRACE_INCLUDES,
      '/api/v2/partner/finances-statement-pdf': PDF_TRACE_INCLUDES,
      '/api/admin/finances/payout-batches/[id]/bank-package': PDF_TRACE_INCLUDES,
      '/api/admin/finance/intelligence/pdf': PDF_TRACE_INCLUDES,
    },
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      const ext = config.externals
      const pdfkitExt = ({ request }, callback) => {
        if (request === 'pdfkit' || (typeof request === 'string' && request.startsWith('pdfkit/'))) {
          return callback(null, `commonjs ${request}`)
        }
        callback()
      }
      if (Array.isArray(ext)) {
        config.externals = [...ext, pdfkitExt]
      } else if (typeof ext === 'function') {
        config.externals = [ext, pdfkitExt]
      } else {
        config.externals = [pdfkitExt]
      }
    }
    return config
  },

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
      ...[publicSupabaseHost, serverSupabaseHost]
        .filter(Boolean)
        .flatMap((hostname) => [
          {
            protocol: 'https',
            hostname,
            pathname: '/storage/v1/object/public/**',
          },
          {
            protocol: 'https',
            hostname,
            pathname: '/storage/v1/object/sign/**',
          },
          ...(hostname === publicSupabaseHost && supabasePublicUrl?.includes('/supabase')
            ? [
                {
                  protocol: 'https',
                  hostname,
                  pathname: '/supabase/storage/v1/object/public/**',
                },
                {
                  protocol: 'https',
                  hostname,
                  pathname: '/supabase/storage/v1/object/sign/**',
                },
              ]
            : []),
        ]),
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
    if (!supabaseServerUrl) return []
    const base = supabaseServerUrl.replace(/\/$/, '')
    return [
      {
        source: '/_db/:path*',
        destination: `${base}/rest/v1/:path*`,
      },
      // Public Storage objects: same-origin path hides Supabase host, but URLs remain world-fetchable
      // if the bucket is public. KYC in `verification_documents` should be opened via
      // GET /api/v2/admin/verification-doc (ADMIN + signed URL), not linked raw in external channels.
      {
        source: '/_storage/:path*',
        destination: `${base}/storage/v1/object/public/:path*`,
      },
    ]
  },
}

module.exports = withBundleAnalyzer(nextConfig)
