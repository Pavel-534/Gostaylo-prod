/**
 * Stage 201.09 — Vercel Cron GET has no query string; execute when `x-vercel-cron: 1`.
 * Manual calls stay dry-run unless `dryRun=false`.
 *
 * @param {{ url: string, headers: { get: (name: string) => string | null } }} request
 */
export function resolveCleanupTestDataDryRun(request) {
  const url = new URL(request.url)
  const param = String(url.searchParams.get('dryRun') || '').toLowerCase()
  if (param === 'false' || param === '0') return false
  if (param === 'true' || param === '1') return true
  return request.headers.get('x-vercel-cron') !== '1'
}
