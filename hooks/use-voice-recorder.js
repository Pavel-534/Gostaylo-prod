'use client'

/**
 * useVoiceRecorder — хук для записи голосовых сообщений через Web MediaRecorder API.
 *
 * Возвращает:
 *  - isRecording: bool — сейчас идёт запись
 *  - duration: number — прошедшее время (секунды)
 *  - audioBlob: Blob | null — готовый аудиофайл после остановки
 *  - audioUrl: string | null — ObjectURL для предпрослушивания
 *  - error: string | null — сообщение об ошибке (нет разрешения и т.д.)
 *  - startRecording() — начать запись
 *  - stopRecording() — остановить и получить blob
 *  - discardRecording() — удалить и сбросить состояние
 */

import { useState, useRef, useCallback, useEffect } from 'react'

const MAX_DURATION_SEC = 120 // максимум 2 минуты

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  /** Ссылка на ObjectURL — чтобы не терять revoke при смене замыканий в startRecording */
  const audioUrlRef = useRef(null)
  /** Не создавать blob в onstop при принудительной остановке перед новой записью */
  const skipNextBlobRef = useRef(false)

  function revokePreviewUrl() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setAudioUrl(null)
  }

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      revokePreviewUrl()
      stopStream()
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    clearInterval(timerRef.current)
    skipNextBlobRef.current = false
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      skipNextBlobRef.current = true
      mediaRecorderRef.current.stop()
    }
    stopStream()
    revokePreviewUrl()
    setAudioBlob(null)
    setDuration(0)
    chunksRef.current = []
    mediaRecorderRef.current = null

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Нет доступа к микрофону. Разрешите доступ в настройках браузера.')
      return
    }
    streamRef.current = stream

    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]
    const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      if (skipNextBlobRef.current) {
        skipNextBlobRef.current = false
        stopStream()
        chunksRef.current = []
        return
      }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      revokePreviewUrl()
      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url
      setAudioBlob(blob)
      setAudioUrl(url)
      stopStream()
    }

    recorder.start(100)
    setIsRecording(true)
    setDuration(0)

    let secs = 0
    timerRef.current = setInterval(() => {
      secs += 1
      setDuration(secs)
      if (secs >= MAX_DURATION_SEC) {
        stopRecordingInternal(recorder)
      }
    }, 1000)
  }, [])

  function stopRecordingInternal(recorder) {
    clearInterval(timerRef.current)
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    setIsRecording(false)
  }

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      stopRecordingInternal(mediaRecorderRef.current)
    }
  }, [])

  const discardRecording = useCallback(() => {
    clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      skipNextBlobRef.current = true
      mediaRecorderRef.current.stop()
    }
    stopStream()
    revokePreviewUrl()
    setAudioBlob(null)
    setDuration(0)
    setIsRecording(false)
    setError(null)
    chunksRef.current = []
  }, [])

  function fmtDuration(sec) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return {
    isRecording,
    duration,
    durationLabel: fmtDuration(duration),
    audioBlob,
    audioUrl,
    error,
    startRecording,
    stopRecording,
    discardRecording,
  }
}
