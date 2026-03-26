'use client'

/**
 * ChatVoicePlayer — аудиоплеер для голосовых сообщений в ленте чата.
 * Отображается вместо пузыря для сообщений с type="voice".
 *
 * Пропы:
 *  - url: string — публичный URL аудиофайла
 *  - durationSec: number — длительность (из metadata)
 *  - isOwn: bool — своё сообщение (влияет на цвет)
 *  - ownVariant: 'teal' | 'indigo'
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Pause, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmtTime(sec) {
  if (!isFinite(sec) || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ChatVoicePlayer({ url, durationSec = 0, isOwn = false, ownVariant = 'teal' }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(durationSec || 0)
  const rafRef = useRef(null)

  const ownBg = ownVariant === 'indigo' ? 'bg-indigo-600' : 'bg-teal-600'
  const ownTrack = ownVariant === 'indigo' ? 'bg-indigo-400' : 'bg-teal-400'
  const ownThumb = 'bg-white'
  const guestBg = 'bg-white border border-slate-200 shadow-sm'
  const guestTrack = 'bg-teal-200'

  const tick = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    setCurrent(el.currentTime)
    if (!el.paused) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [])

  function handlePlay() {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
    } else {
      el.play().catch(() => {})
      rafRef.current = requestAnimationFrame(tick)
    }
  }

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onPlay = () => setPlaying(true)
    const onPause = () => { setPlaying(false); cancelAnimationFrame(rafRef.current) }
    const onEnded = () => { setPlaying(false); setCurrent(0); cancelAnimationFrame(rafRef.current) }
    const onMeta = () => { if (isFinite(el.duration)) setTotal(el.duration) }

    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('loadedmetadata', onMeta)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('loadedmetadata', onMeta)
      cancelAnimationFrame(rafRef.current)
    }
  }, [tick])

  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0

  function handleSeek(e) {
    const el = audioRef.current
    if (!el || !total) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    el.currentTime = ratio * total
    setCurrent(ratio * total)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-2xl px-3 py-2.5 min-w-[180px] max-w-[240px]',
        isOwn
          ? cn(ownBg, 'rounded-tr-none')
          : cn(guestBg, 'rounded-tl-none'),
      )}
    >
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Кнопка play/pause */}
      <button
        type="button"
        onClick={handlePlay}
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
          isOwn
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-teal-50 hover:bg-teal-100 text-teal-700',
        )}
        aria-label={playing ? 'Пауза' : 'Воспроизвести'}
      >
        {playing
          ? <Pause className="h-4 w-4" />
          : <Play className="h-4 w-4 translate-x-0.5" />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Полоса прогресса */}
        <div
          className={cn(
            'relative h-1.5 rounded-full cursor-pointer overflow-hidden',
            isOwn ? 'bg-white/30' : 'bg-slate-200',
          )}
          onClick={handleSeek}
          role="slider"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          onKeyDown={(e) => {
            const el = audioRef.current
            if (!el) return
            if (e.key === 'ArrowRight') el.currentTime = Math.min(el.currentTime + 5, total)
            if (e.key === 'ArrowLeft') el.currentTime = Math.max(el.currentTime - 5, 0)
          }}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-100',
              isOwn ? 'bg-white' : 'bg-teal-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Таймер + иконка */}
        <div className="flex items-center justify-between">
          <span className={cn('text-[10px] tabular-nums', isOwn ? 'text-white/70' : 'text-slate-500')}>
            {playing || current > 0 ? fmtTime(current) : fmtTime(total)}
          </span>
          <Mic className={cn('h-3 w-3', isOwn ? 'text-white/60' : 'text-slate-400')} />
        </div>
      </div>
    </div>
  )
}
