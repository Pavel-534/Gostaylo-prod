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

const nextConfig = {
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
