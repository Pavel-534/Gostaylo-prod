/**
 * Короткий ненавязчивый звук достижения (Web Audio). Без файловых ассетов.
 */

export function playReferralAchievementChime() {
  if (typeof window === 'undefined') return
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12)
    g.gain.setValueAtTime(0.001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.065, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    o.connect(g)
    g.connect(ctx.destination)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.22)
    const close = ctx.close.bind(ctx)
    window.setTimeout(() => {
      void close().catch(() => {})
    }, 380)
  } catch {
    /* ignore */
  }
}
