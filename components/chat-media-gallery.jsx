'use client'

/**
 * ChatMediaGallery — модальная галерея всех медиафайлов диалога.
 * Показывает сетку изображений (type:"image") и карточки голосовых (type:"voice").
 * Открывается из StickyChatHeader по иконке 🖼️.
 *
 * Props:
 *  - messages: Array — все сообщения треда
 *  - open: bool
 *  - onClose: () => void
 *  - language: 'ru' | 'en' | 'th' | 'zh'
 */

import { useMemo, useState } from 'react'
import { X, Image as ImageIcon, Mic, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatVoicePlayer } from '@/components/chat-voice-player'
import { ChatLightbox } from '@/components/chat-image-collage'
import { toPublicImageUrl } from '@/lib/public-image-url'

const LABELS = {
  ru: {
    title: 'Медиафайлы',
    images: 'Изображения',
    voice: 'Голосовые',
    empty: 'В этом диалоге пока нет медиафайлов.',
    download: 'Скачать',
  },
  en: {
    title: 'Media files',
    images: 'Images',
    voice: 'Voice messages',
    empty: 'No media files in this conversation yet.',
    download: 'Download',
  },
  th: {
    title: 'ไฟล์มีเดีย',
    images: 'รูปภาพ',
    voice: 'ข้อความเสียง',
    empty: 'ยังไม่มีไฟล์มีเดียในการสนทนานี้',
    download: 'ดาวน์โหลด',
  },
  zh: {
    title: '媒体文件',
    images: '图片',
    voice: '语音消息',
    empty: '此对话中暂无媒体文件。',
    download: '下载',
  },
}

function getLabel(language, key) {
  return (LABELS[language] || LABELS.ru)[key]
}

export function ChatMediaGallery({ messages = [], open, onClose, language = 'ru' }) {
  const [tab, setTab] = useState('images')
  const [lightboxIdx, setLightboxIdx] = useState(null)

  const imageMessages = useMemo(
    () =>
      messages.filter((m) => {
        const t = String(m.type || '').toLowerCase()
        if (t === 'image') return true
        if (m.metadata?.image_url || m.metadata?.url) return true
        return false
      }),
    [messages],
  )

  const voiceMessages = useMemo(
    () =>
      messages.filter((m) => {
        const t = String(m.type || '').toLowerCase()
        return t === 'voice' && m.metadata?.voice_url
      }),
    [messages],
  )

  const lightboxImages = useMemo(
    () =>
      imageMessages.map((m) => ({
        id: m.id,
        url: toPublicImageUrl(m.metadata?.image_url || m.metadata?.url || '') || '',
        alt: m.message || m.content || '',
      })),
    [imageMessages],
  )

  if (!open) return null

  const hasImages = imageMessages.length > 0
  const hasVoice = voiceMessages.length > 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {getLabel(language, 'title')}
          </h2>
          <button
            type="button"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setTab('images')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
              tab === 'images'
                ? 'border-b-2 border-teal-600 text-teal-700'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <ImageIcon className="h-4 w-4" />
            {getLabel(language, 'images')}
            {hasImages && (
              <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] text-teal-700">
                {imageMessages.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('voice')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
              tab === 'voice'
                ? 'border-b-2 border-teal-600 text-teal-700'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <Mic className="h-4 w-4" />
            {getLabel(language, 'voice')}
            {hasVoice && (
              <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] text-teal-700">
                {voiceMessages.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'images' && (
            <>
              {!hasImages ? (
                <p className="py-12 text-center text-sm text-slate-400">
                  {getLabel(language, 'empty')}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {imageMessages.map((m, idx) => {
                    const url = toPublicImageUrl(m.metadata?.image_url || m.metadata?.url || '') || ''
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100"
                        onClick={() => setLightboxIdx(idx)}
                      >
                        <img
                          src={url}
                          alt={m.message || ''}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                        <a
                          href={url}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-1 right-1 hidden rounded-full bg-black/50 p-1 text-white group-hover:flex"
                          onClick={(e) => e.stopPropagation()}
                          title={getLabel(language, 'download')}
                        >
                          <Download className="h-3 w-3" />
                        </a>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'voice' && (
            <>
              {!hasVoice ? (
                <p className="py-12 text-center text-sm text-slate-400">
                  {getLabel(language, 'empty')}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {voiceMessages.map((m) => (
                    <div key={m.id} className="flex flex-col gap-1">
                      <ChatVoicePlayer
                        url={m.metadata.voice_url}
                        durationSec={m.metadata.duration_sec || 0}
                        isOwn={false}
                      />
                      {m.created_at && (
                        <p className="pl-1 text-[10px] text-slate-400">
                          {new Date(m.created_at).toLocaleString(
                            language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'ru-RU',
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && lightboxImages.length > 0 && (
        <ChatLightbox
          images={lightboxImages}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  )
}
