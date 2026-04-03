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
 *   sidePanelSlot  — правая колонка (~300px, только lg+): детали сделки. На мобиле —
 *                    тот же контент открывается из шапки через Sheet (см. StickyChatHeader).
 *
 * Адаптивность:
 *   – мобиле (<lg): сайдбар | тред (без side panel в потоке)
 *   – десктоп (>=lg): сайдбар | тред | side panel
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
 * @param {React.ReactNode} [props.pinnedAboveMessagesSlot] — под шапкой, над прокруткой ленты (баннер админа и т.п.)
 * @param {React.ReactNode} [props.messagesSlot]  — лента сообщений (ChatMessageList)
 * @param {React.ReactNode} [props.composerSlot]  — поле ввода (Composer)
 * @param {React.ReactNode} [props.emptySlot]     — placeholder когда тред не выбран
 * @param {React.ReactNode} [props.sidePanelSlot] — правая колонка (десктоп): детали сделки
 * @param {string}          [props.language]      — для i18n пустого состояния
 * @param {string}          [props.className]
 */
export function ChatThreadChrome({
  hasTread = false,
  sidebarSlot,
  headerSlot,
  actionBarSlot,
  searchBarSlot,
  pinnedAboveMessagesSlot,
  messagesSlot,
  composerSlot,
  emptySlot,
  sidePanelSlot = null,
  language = 'ru',
  className,
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-1 overflow-hidden bg-white',
        className,
      )}
    >
      {/* ── Левая колонка: список диалогов ──────────────────────────────── */}
      <aside
        className={cn(
          'flex h-full min-h-0 w-full flex-shrink-0 flex-col overflow-hidden',
          'lg:w-80',
          hasTread ? 'hidden lg:flex' : 'flex',
          'border-r border-slate-200',
        )}
      >
        {sidebarSlot ?? <DefaultSidebarEmpty language={language} />}
      </aside>

      {/* ── Центр + правая панель (тред | side panel) ───────────────────
          Grid + minmax(0,1fr): иначе при flex иногда соседняя колонка 300px
          визуально наезжает на шапку/кнопки треда (paint order второго flex-child). */}
      <div
        className={cn(
          'grid flex-1 min-h-0 min-w-0 overflow-hidden',
          hasTread && sidePanelSlot
            ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]'
            : 'grid-cols-1',
          hasTread ? 'grid' : 'hidden lg:grid',
        )}
      >
        {/* ── Область треда ──────────────────────────────────────────── */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:min-w-0">
          {hasTread ? (
            <>
              {headerSlot && (
                <div className="flex-shrink-0 z-10">
                  {headerSlot}
                </div>
              )}

              {(actionBarSlot || searchBarSlot) && (
                <div className="flex-shrink-0 border-b border-slate-100 bg-white">
                  {actionBarSlot}
                  {searchBarSlot}
                </div>
              )}

              {pinnedAboveMessagesSlot ? (
                <div className="flex-shrink-0 border-b border-slate-100 bg-white">
                  {pinnedAboveMessagesSlot}
                </div>
              ) : null}

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                {messagesSlot}
              </div>

              {composerSlot && (
                <div className="flex-shrink-0 border-t border-slate-200/90 bg-white">
                  {composerSlot}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              {emptySlot ?? <DefaultEmptyState language={language} />}
            </div>
          )}
        </section>

        {/* ── Side panel: только lg+, мобиле — Sheet из шапки ─────────── */}
        {hasTread && sidePanelSlot ? (
          <aside
            className={cn(
              'hidden min-h-0 min-w-0 flex-col border-l border-slate-200 lg:flex',
              'w-full bg-slate-50/90 overflow-y-auto overscroll-contain lg:w-auto',
            )}
          >
            {sidePanelSlot}
          </aside>
        ) : null}
      </div>
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
