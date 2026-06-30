/**
 * Stage 176.0 — automatic review text screening (contact leak + coarse profanity).
 * SSOT for POST /api/v2/reviews and POST /api/v2/partner/guest-reviews.
 */

import { detectContactSafety } from '@/lib/chat/contact-safety-detection'

/** Generic off-platform links / ad domains (beyond messenger-specific patterns). */
const HTTP_URL_REGEX = /\bhttps?:\/\/[^\s<>"']+/gi
const WWW_URL_REGEX = /\bwww\.[a-z0-9][-a-z0-9]*(?:\.[a-z]{2,})+[^\s]*/gi

/**
 * Coarse profanity (RU / EN / TH) — word-boundary match; false positives acceptable at flag stage.
 * Staff can approve later; goal is to catch obvious abuse without blocking submission.
 */
const PROFANITY_REGEX =
  /\b(?:fuck(?:ing|ed|er)?|shit(?:ty)?|bitch(?:es)?|asshole|bastard|cunt|dick(?:head)?|whore|slut|сука|бля(?:дь|ть|д)?|хуй(?:ня|ло|ёв)?|пизд(?:а|ец|ёж)|еба(?:ть|н|л)|ёб(?:ан|нут)|говн(?:о|я)|мудак(?:и)?|идиот(?:ы)?|дебил(?:ы)?|чмо|залупа|мразь|уёб(?:ок|ки)|ควย|เหี้ย|สัส|ไอ้สัตว์)\b/giu

/**
 * @param {string | null | undefined} text
 * @returns {{ shouldFlag: boolean, reasons: string[] }}
 */
export function guardReviewComment(text) {
  const src = String(text || '').trim()
  if (!src) {
    return { shouldFlag: false, reasons: [] }
  }

  const reasons = []

  const contact = detectContactSafety(src)
  if (contact.hasSafetyTrigger) {
    reasons.push(`contact:${contact.matchTypes.join(',')}`)
  }

  if (HTTP_URL_REGEX.test(src)) {
    reasons.push('url:http')
  }
  HTTP_URL_REGEX.lastIndex = 0

  if (WWW_URL_REGEX.test(src)) {
    reasons.push('url:www')
  }
  WWW_URL_REGEX.lastIndex = 0

  if (PROFANITY_REGEX.test(src)) {
    reasons.push('profanity')
  }
  PROFANITY_REGEX.lastIndex = 0

  return {
    shouldFlag: reasons.length > 0,
    reasons,
  }
}
