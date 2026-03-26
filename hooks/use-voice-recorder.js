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

  // Очищаем ObjectURL при размонтировании
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      stopStream()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  const startRecording = useCallback(async () => {
    setError(null)
    discardRecording()

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Нет доступа к микрофону. Разрешите доступ в настройках браузера.')
      return
    }
    streamRef.current = stream

    // Подбираем поддерживаемый формат
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
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      const url = URL.createObjectURL(blob)
      setAudioBlob(blob)
      setAudioUrl(url)
      stopStream()
    }

    recorder.start(100) // сохраняем чанки каждые 100ms
    setIsRecording(true)
    setDuration(0)

    // Таймер
    let secs = 0
    timerRef.current = setInterval(() => {
      secs += 1
      setDuration(secs)
      if (secs >= MAX_DURATION_SEC) {
        stopRecordingInternal(recorder)
      }
    }, 1000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      mediaRecorderRef.current.stop()
    }
    stopStream()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setDuration(0)
    setIsRecording(false)
    setError(null)
    chunksRef.current = []
  }, [audioUrl])

  /** Форматирует секунды → "0:23" */
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
