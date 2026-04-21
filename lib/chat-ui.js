/**
 * Общие Tailwind-классы для чата (композер, чтобы рендер не расходился между экранами).
 * Верхнюю границу даёт обёртка в ChatThreadChrome — здесь только отступы и фон.
 */
export const CHAT_COMPOSER_SHELL_CLASS =
  'shrink-0 bg-white px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-3.5 sm:pb-[max(1rem,env(safe-area-inset-bottom,0px))]'
