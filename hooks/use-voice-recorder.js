'use client'

/**
 * useVoiceRecorder — Web MediaRecorder for chat voice messages.
 *
 * Samsung Internet / WebKit: prefer supported mime (mp4/aac when webm missing);
 * MediaRecorder construction wrapped; empty blobs rejected.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

const MAX_DURATION_SEC = 120
const MIN_BLOB_BYTES = 256

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return null
  if (typeof MediaRecorder.isTypeSupported !== 'function') return ''
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m
    } catch {
      /* ignore */
    }
  }
  return ''
}

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
  const audioUrlRef = useRef(null)
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
      clearInterval(timerRef.current)
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    clearInterval(timerRef.current)
    skipNextBlobRef.current = false
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      skipNextBlobRef.current = true
      try {
        mediaRecorderRef.current.stop()
      } catch {
        /* ignore */
      }
    }
    stopStream()
    revokePreviewUrl()
    setAudioBlob(null)
    setDuration(0)
    chunksRef.current = []
    mediaRecorderRef.current = null

    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      setError('__VOICE_UNSUPPORTED__')
      return
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('__VOICE_UNSUPPORTED__')
      return
    }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('__VOICE_MIC_DENIED__')
      return
    }
    streamRef.current = stream

    const mimeType = pickRecorderMime()
    if (mimeType === null) {
      stopStream()
      setError('__VOICE_UNSUPPORTED__')
      return
    }

    let recorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      try {
        recorder = new MediaRecorder(stream)
      } catch {
        stopStream()
        setError('__VOICE_UNSUPPORTED__')
        return
      }
    }

    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onerror = () => {
      setError('__VOICE_UNSUPPORTED__')
      clearInterval(timerRef.current)
      setIsRecording(false)
      stopStream()
    }

    recorder.onstop = () => {
      if (skipNextBlobRef.current) {
        skipNextBlobRef.current = false
        stopStream()
        chunksRef.current = []
        return
      }
      const type = recorder.mimeType || mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type })
      stopStream()
      if (!blob.size || blob.size < MIN_BLOB_BYTES) {
        setError('__VOICE_TOO_SHORT__')
        chunksRef.current = []
        return
      }
      revokePreviewUrl()
      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url
      setAudioBlob(blob)
      setAudioUrl(url)
    }

    try {
      recorder.start(250)
    } catch {
      stopStream()
      setError('__VOICE_UNSUPPORTED__')
      return
    }

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
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
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
      try {
        mediaRecorderRef.current.stop()
      } catch {
        /* ignore */
      }
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
