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

/** Lowercase alias → canonical district (write-path normalization).
 * @deprecated Stage 158.3 for suggest — aliases in `geo_synonyms`. Still used by `resolve-listing-geo-snapshot.js`.
 */
export const PHUKET_DISTRICT_ALIASES = Object.freeze({
  'cape panwa': 'Panwa',
  'cherng talay': 'Cherngtalay',
  'phuket town': 'Phuket Town',
  thalang: 'Thalang',
  chalong: 'Chalong',
  patong: 'Patong',
  rawai: 'Rawai',
  kata: 'Kata',
  'kata beach': 'Kata',
  'ban kata': 'Kata',
  'ban kata kiri': 'Kata',
  karon: 'Karon',
  kamala: 'Kamala',
  surin: 'Surin',
  'bang tao': 'Bang Tao',
  bangtao: 'Bang Tao',
  'nai harn': 'Nai Harn',
  naiharn: 'Nai Harn',
  panwa: 'Panwa',
  'mai khao': 'Mai Khao',
  maikhao: 'Mai Khao',
  'nai yang': 'Nai Yang',
  naiyang: 'Nai Yang',
  cherngtalay: 'Cherngtalay',
})

/** @deprecated Use PHUKET_DISTRICTS_CANON */
export const PHUKET_DISTRICTS = PHUKET_DISTRICTS_CANON
