/**
 * Единые дизайн-токены: сайт (CSS / Tailwind) и транзакционные письма (inline HTML).
 * Меняйте значения здесь — стиль писем подтянется через lib/email/premium-email-html.js.
 *
 * Стек шрифтов: держите в синхроне с lib/theme/font-stack.cjs (Tailwind + @apply font-sans).
 */

export const theme = {
  colors: {
    /** Фирменный акцент (teal, «лёгкий» премиум) */
    primary: '#0d9488',
    primaryForeground: '#ffffff',
    /** Hover для кнопок на сайте; в письмах оставляем как подсказку для веб-версии */
    primaryHover: '#0f766e',
    background: '#ffffff',
    /** Фон «полотна» за карточкой письма */
    canvas: '#f4f6f8',
    /** Основной текст */
    text: '#1e293b',
    muted: '#64748b',
    subtle: '#94a3b8',
    border: '#e8ecf0',
    divider: '#eef1f4',
    /** Светлые подложки карточек */
    tint: '#f0fdfa',
  },
  /** Скругления в px (как на сайте — см. components/ui/button.jsx) */
  borderRadius: '16px',
  fonts: {
    main:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, ' +
      '"Helvetica Neue", Helvetica, Arial, "Noto Sans", "Liberation Sans", sans-serif, ' +
      '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  },
  shadows: {
    /** Полная декларация для HTML-строк писем */
    card: 'box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06);',
    soft: 'box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);',
    /** Только значение для React style={{ boxShadow }} */
    cardBox: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
    softBox: '0 1px 3px rgba(15, 23, 42, 0.08)',
  },
}

/** Для импорта в Tailwind / других модулях без объекта theme */
export const brandPrimaryHex = theme.colors.primary
