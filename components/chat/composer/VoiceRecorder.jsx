'use client'

/**
 * @file components/chat/composer/VoiceRecorder.jsx
 *
 * Самодостаточный виджет голосовой записи для чат-композера.
 */

import { useEffect, useCallback, useState } from 'react'
import { Loader2, Mic, MicOff, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
import { uploadChatVoice } from '@/lib/chat-upload'

export function VoiceRecorder({ showMicTrigger, userId, language = 'ru', onSend, onActiveChange, disabled }) {
  const tx = (key) => getUIText(key, language)

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

  const isActive = isRecording || !!audioBlob
  useEffect(() => {
    onActiveChange?.(isActive)
  }, [isActive, onActiveChange])

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
      toast.error(e?.message || tx('chatVoiceSendError'))
    } finally {
      setVoiceSending(false)
    }
  }, [audioBlob, userId, duration, onSend, discardRecording, language])

  if (audioBlob) {
    return (
      <div className="flex w-full min-w-0 min-h-10 flex-1 items-center gap-2 rounded-2xl border border-brand/25 bg-brand/10 px-2 py-1.5 sm:px-3 sm:py-2">
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
        <span className="text-xs text-brand-hover font-medium tabular-nums shrink-0">{durationLabel}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-2xl text-red-500 hover:bg-red-50"
          onClick={discardRecording}
          title={tx('chatDiscardVoice')}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="brand"
          disabled={voiceSending}
          className="h-11 min-h-[44px] shrink-0 rounded-2xl px-4"
          onClick={handleSend}
        >
          {voiceSending
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : <Send className="h-5 w-5" />}
        </Button>
      </div>
    )
  }

  if (isRecording) {
    return (
      <div className="flex min-h-10 w-full min-w-0 flex-1 items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-2 py-1.5 sm:px-3 sm:py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-sm text-red-700 font-medium flex-1">
          {tx('chatVoiceRecording')} {durationLabel}
        </span>
        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-2xl bg-red-500 hover:bg-red-600"
          onClick={stopRecording}
          title={tx('chatDiscardVoice')}
        >
          <MicOff className="h-5 w-5 text-white" />
        </Button>
      </div>
    )
  }

  if (!showMicTrigger) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-12 w-12 shrink-0 rounded-2xl border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      disabled={disabled}
      onClick={startRecording}
      title={tx('messengerThread_voiceMessage')}
    >
      <Mic className="h-5 w-5" />
    </Button>
  )
}
