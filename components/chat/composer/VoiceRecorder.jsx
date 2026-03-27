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
import { uploadChatFile } from '@/lib/chat-upload'

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
      const ext = audioBlob.type.includes('ogg') ? 'ogg'
        : audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: audioBlob.type })
      const { url } = await uploadChatFile(file, userId)
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
      <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-50 border border-teal-200">
        <audio src={audioUrl} controls className="h-8 flex-1 min-w-0" />
        <span className="text-xs text-teal-700 font-medium tabular-nums shrink-0">{durationLabel}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:bg-red-50 shrink-0"
          onClick={discardRecording}
          title={isRu ? 'Удалить' : 'Discard'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          disabled={voiceSending}
          className="h-8 px-3 bg-teal-600 hover:bg-teal-700 shrink-0"
          onClick={handleSend}
        >
          {voiceSending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4" />}
        </Button>
      </div>
    )
  }

  // ── Состояние «запись» ───────────────────────────────────────────────────
  if (isRecording) {
    return (
      <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-sm text-red-700 font-medium flex-1">
          {isRu ? 'Запись...' : 'Recording...'} {durationLabel}
        </span>
        <Button
          type="button"
          size="icon"
          className="h-8 w-8 bg-red-500 hover:bg-red-600 shrink-0"
          onClick={stopRecording}
          title={isRu ? 'Остановить' : 'Stop'}
        >
          <MicOff className="h-4 w-4 text-white" />
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
      className="h-10 w-10 flex-shrink-0 border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
      disabled={disabled}
      onClick={startRecording}
      title={isRu ? 'Голосовое сообщение' : 'Voice message'}
    >
      <Mic className="h-4 w-4" />
    </Button>
  )
}
