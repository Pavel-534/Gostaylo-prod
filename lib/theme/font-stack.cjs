/**
 * Единый стек шрифтов для Tailwind и globals.css (@apply font-sans).
 * Источник правды — массив ниже.
 *
 * Важно: `theme.fonts.main` в lib/theme/constants.js должен совпадать с FONT_STACK_SANS
 * (тот файл тянется в клиентский бандл — без require из .cjs).
 */
const FONT_STACK_PARTS = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"SF Pro Text"',
  '"SF Pro Display"',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Helvetica',
  'Arial',
  '"Noto Sans"',
  '"Liberation Sans"',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
  '"Noto Color Emoji"',
]

module.exports.FONT_STACK_PARTS = FONT_STACK_PARTS
module.exports.FONT_STACK_SANS = FONT_STACK_PARTS.join(', ')
