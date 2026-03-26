'use client'

/**
 * @file components/chat/ChatThreadChrome.jsx
 *
 * «Каркас» экрана чата. Делит viewport на:
 *   – Левую колонку (список диалогов, 320px на десктопе, полный экран на мобиле)
 *   – Правую область (активный тред)
 *
 * Слот-паттерн (composition):
 *   sidebarSlot    — всё левое: ConversationList или PartnerInbox / RenterInbox
 *   headerSlot     — StickyChatHeader (прилипает к верху треда)
 *   messagesSlot   — ChatMessageList (прокручиваемая лента)
 *   composerSlot   — PartnerChatComposer / RenterChatComposer (поле ввода снизу)
 *   actionBarSlot  — ChatActionBar под шапкой (кнопки Pay, Confirm, Decline, Invoice…)
 *   searchBarSlot  — ChatSearchBar (появляется под шапкой при searchActive=true)
 *
 * Фаза 4 «вставит» в эти слоты готовые компоненты для Партнёра и Рентера.
 *
 * Адаптивность:
 *   – мобиле (<lg): показывается либо сайдбар, либо тред (переключение через hasTread)
 *   – десктоп (>=lg): side-by-side
 *
 * Использование (пример Фазы 4):
 * ```jsx
 * <ChatThreadChrome
 *   hasTread={!!conversationId}
 *   sidebarSlot={<PartnerInboxPanel />}
 *   headerSlot={<StickyChatHeader ... />}
 *   messagesSlot={<ChatMessageList ... />}
 *   composerSlot={<PartnerChatComposer ... />}
 * />
 * ```
 */

import { cn } from '@/lib/utils'
import { MessageSquare } from 'lucide-react'

// ─── Компонент ────────────────────────────────────────────────────────────────

/**
 * @param {Object}          props
 * @param {boolean}         props.hasTread        — true если открыт конкретный тред
 * @param {React.ReactNode} [props.sidebarSlot]   — левая панель (список диалогов)
 * @param {React.ReactNode} [props.headerSlot]    — шапка треда (StickyChatHeader)
 * @param {React.ReactNode} [props.actionBarSlot] — панель действий под шапкой
 * @param {React.ReactNode} [props.searchBarSlot] — строка поиска (под шапкой)
 * @param {React.ReactNode} [props.messagesSlot]  — лента сообщений (ChatMessageList)
 * @param {React.ReactNode} [props.composerSlot]  — поле ввода (Composer)
 * @param {React.ReactNode} [props.emptySlot]     — placeholder когда тред не выбран
 * @param {string}          [props.language]      — для i18n пустого состояния
 * @param {string}          [props.className]
 */
export function ChatThreadChrome({
  hasTread = false,
  sidebarSlot,
  headerSlot,
  actionBarSlot,
  searchBarSlot,
  messagesSlot,
  composerSlot,
  emptySlot,
  language = 'ru',
  className,
}) {
  return (
    <div
      className={cn(
        'flex h-[calc(100vh-4rem)] overflow-hidden bg-white',
        className,
      )}
    >
      {/* ── Левая колонка: список диалогов ──────────────────────────────── */}
      <aside
        className={cn(
          // Мобиле: занимает весь экран пока тред не открыт
          'flex-shrink-0 flex flex-col',
          'w-full lg:w-80',
          hasTread ? 'hidden lg:flex' : 'flex',
          'border-r border-slate-200',
        )}
      >
        {sidebarSlot ?? <DefaultSidebarEmpty language={language} />}
      </aside>

      {/* ── Правая область: тред ────────────────────────────────────────── */}
      <section
        className={cn(
          'flex-1 flex flex-col min-w-0 overflow-hidden',
          // Мобиле: показываем только если тред открыт
          hasTread ? 'flex' : 'hidden lg:flex',
        )}
      >
        {hasTread ? (
          <>
            {/* Шапка (прилипает к верху) */}
            {headerSlot && (
              <div className="flex-shrink-0 z-10">
                {headerSlot}
              </div>
            )}

            {/* Action Bar (кнопки) и Search Bar — под шапкой, если переданы */}
            {(actionBarSlot || searchBarSlot) && (
              <div className="flex-shrink-0 border-b border-slate-100 bg-white">
                {actionBarSlot}
                {searchBarSlot}
              </div>
            )}

            {/* Лента сообщений — растягивается и прокручивается */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              {messagesSlot}
            </div>

            {/* Composer (поле ввода) — прилипает к низу */}
            {composerSlot && (
              <div className="flex-shrink-0 border-t border-slate-100 bg-white">
                {composerSlot}
              </div>
            )}
          </>
        ) : (
          /* Пустое состояние: тред не выбран */
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            {emptySlot ?? <DefaultEmptyState language={language} />}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Дефолтные заглушки ───────────────────────────────────────────────────────

function DefaultEmptyState({ language = 'ru' }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center px-8 max-w-sm">
      <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center">
        <MessageSquare className="h-8 w-8 text-teal-400" />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-700">
          {language === 'ru' ? 'Выберите диалог' : 'Select a conversation'}
        </p>
        <p className="text-sm text-slate-400 mt-1">
          {language === 'ru'
            ? 'Нажмите на любой диалог слева, чтобы открыть переписку'
            : 'Click any conversation on the left to open the chat'}
        </p>
      </div>
    </div>
  )
}

function DefaultSidebarEmpty({ language = 'ru' }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <p className="text-sm text-slate-400">
        {language === 'ru' ? 'Загрузка…' : 'Loading…'}
      </p>
    </div>
  )
}
