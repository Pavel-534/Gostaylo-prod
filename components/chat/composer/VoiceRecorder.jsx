'use client'

/**
 * @file components/chat/composer/VoiceRecorder.jsx
 *
 * Самодостаточный виджет голосовой записи для чат-композера.
 *
 * Управляет тремя состояниями:
 *   idle      → рендерит кнопку микрофона (если showMicTrigger=true)
 *   recording → полосу «Запись… 0:12» + кнопку «Стоп»
 *   preview   → аудиоплеер + длительность + «Удалить» + «Отправить»
 *
 * Коммуникация с родителем:
 *   onSend(url, duration) — колбэк после успешной загрузки файла
 *   onActiveChange(bool)  — true когда recording или preview (скрыть textarea)
 *
 * Использование:
 * ```jsx
 * <VoiceRecorder
 *   showMicTrigger={!newMessage.trim()}
 *   userId={userId}
 *   language="ru"
 *   onSend={handleVoiceSend}
 *   onActiveChange={setVoiceActive}
 *   disabled={disabled}
 * />
 * ```
 */

import { useEffect, useCallback, useState } from 'react'
import { Loader2, Mic, MicOff, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
import { uploadChatVoice } from '@/lib/chat-upload'

/**
 * @param {Object}   props
 * @param {boolean}  props.showMicTrigger  — показать кнопку микрофона (когда textarea пустой)
 * @param {string}   props.userId          — нужен для папки в Storage
 * @param {string}   [props.language]
 * @param {Function} props.onSend          — ({ url: string, duration: number }) => void|Promise
 * @param {Function} [props.onActiveChange] — (isActive: boolean) => void
 * @param {boolean}  [props.disabled]
 */
export function VoiceRecorder({ showMicTrigger, userId, language = 'ru', onSend, onActiveChange, disabled }) {
  const isRu = language !== 'en'

  const {
    isRecording,
    duration,
    durationLabel,
    audioBlob,
    audioUrl,
    error: recorderError,
    startRecording,
    stopRecording,
    discardRecording,
  } = useVoiceRecorder()

  const [voiceSending, setVoiceSending] = useState(false)

  // Сообщаем родителю об активном состоянии
  const isActive = isRecording || !!audioBlob
  useEffect(() => {
    onActiveChange?.(isActive)
  }, [isActive, onActiveChange])

  // Показываем ошибку доступа к микрофону
  useEffect(() => {
    if (recorderError) toast.error(recorderError)
  }, [recorderError])

  const handleSend = useCallback(async () => {
    if (!audioBlob || !userId) return
    setVoiceSending(true)
    try {
      const mime = audioBlob.type || 'audio/webm'
      const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm'
      const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: mime })
      const { url } = await uploadChatVoice(file, userId)
      await onSend?.({ url, duration })
      discardRecording()
    } catch (e) {
      toast.error(e?.message || (isRu ? 'Ошибка отправки голосового' : 'Voice send error'))
    } finally {
      setVoiceSending(false)
    }
  }, [audioBlob, userId, duration, onSend, discardRecording, isRu])

  // ── Состояние «предпросмотр» ─────────────────────────────────────────────
  if (audioBlob) {
    return (
      <div className="flex w-full min-w-0 min-h-10 flex-1 items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <audio
            key={audioUrl || 'preview'}
            src={audioUrl || undefined}
            controls
            playsInline
            preload="auto"
            className="block h-9 w-full max-w-full"
          />
        </div>
        <span className="text-xs text-teal-700 font-medium tabular-nums shrink-0">{durationLabel}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-2xl text-red-500 hover:bg-red-50"
          onClick={discardRecording}
          title={isRu ? 'Удалить' : 'Discard'}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          disabled={voiceSending}
          className="h-11 min-h-[44px] shrink-0 rounded-2xl bg-teal-600 px-4 hover:bg-teal-700"
          onClick={handleSend}
        >
          {voiceSending
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : <Send className="h-5 w-5" />}
        </Button>
      </div>
    )
  }

  // ── Состояние «запись» ───────────────────────────────────────────────────
  if (isRecording) {
    return (
      <div className="flex min-h-10 w-full min-w-0 flex-1 items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-2 py-1.5 sm:px-3 sm:py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-sm text-red-700 font-medium flex-1">
          {isRu ? 'Запись...' : 'Recording...'} {durationLabel}
        </span>
        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-2xl bg-red-500 hover:bg-red-600"
          onClick={stopRecording}
          title={isRu ? 'Остановить' : 'Stop'}
        >
          <MicOff className="h-5 w-5 text-white" />
        </Button>
      </div>
    )
  }

  // ── Состояние «idle» — кнопка микрофона ─────────────────────────────────
  if (!showMicTrigger) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-12 w-12 shrink-0 rounded-2xl border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      disabled={disabled}
      onClick={startRecording}
      title={isRu ? 'Голосовое сообщение' : 'Voice message'}
    >
      <Mic className="h-5 w-5" />
    </Button>
  )
}
