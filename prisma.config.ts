import { defineConfig } from 'prisma/config'

/**
 * Prisma 7.x configuration.
 * Connection URLs are defined here; schema.prisma contains only the provider.
 *
 * On Vercel: DATABASE_URL is injected as a build-time env var.
 * Locally: create .env.local with DATABASE_URL= to run prisma commands.
 */
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
