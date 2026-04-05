/**
 * Проверка: formatPrice делит THB на rate_to_thb, а не только меняет символ.
 * Запуск: npm run verify:currency
 */
import assert from 'node:assert'
import { formatPrice } from '../lib/currency.js'

const rates = { THB: 1, USD: 35, EUR: 38, GBP: 44, CNY: 4.85 }

assert.strictEqual(formatPrice(35000, 'THB', rates), '฿35,000')

const usd = formatPrice(35000, 'USD', rates)
assert.match(usd, /1,?000(\.00)?$/, `USD: ожидали ~1000, получили ${usd}`)

const eur = formatPrice(38000, 'EUR', rates)
assert.match(eur, /1,?000(\.00)?$/, `EUR: ожидали ~1000, получили ${eur}`)

const gbp = formatPrice(44000, 'GBP', rates)
assert.match(gbp, /1,?000(\.00)?$/, `GBP: ожидали ~1000, получили ${gbp}`)

// Нет ключа валюты в rateMap — не делим (остаётся число как в THB, другой символ)
const naked = formatPrice(35000, 'EUR', { THB: 1 })
assert.ok(naked.startsWith('€'), naked)
assert.ok(naked.includes('35'), `без курса EUR не должно конвертировать: ${naked}`)

console.log('verify-format-price: OK', { usd, eur, gbp })
