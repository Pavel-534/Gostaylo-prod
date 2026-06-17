/**
 * Stage 157 — SSOT Phuket districts (wizard, search umbrella, locations API).
 */

/** @type {readonly string[]} */
export const PHUKET_DISTRICTS_CANON = Object.freeze([
  'Rawai',
  'Chalong',
  'Kata',
  'Karon',
  'Patong',
  'Kamala',
  'Surin',
  'Bang Tao',
  'Nai Harn',
  'Panwa',
  'Mai Khao',
  'Nai Yang',
  'Phuket Town',
  'Cherngtalay',
  'Thalang',
])

/** Lowercase alias → canonical district (write-path normalization). */
export const PHUKET_DISTRICT_ALIASES = Object.freeze({
  'cape panwa': 'Panwa',
  'cherng talay': 'Cherngtalay',
  'phuket town': 'Phuket Town',
  thalang: 'Thalang',
  chalong: 'Chalong',
  patong: 'Patong',
  rawai: 'Rawai',
})

/** @deprecated Use PHUKET_DISTRICTS_CANON */
export const PHUKET_DISTRICTS = PHUKET_DISTRICTS_CANON
