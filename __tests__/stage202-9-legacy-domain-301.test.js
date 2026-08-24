/**
 * Stage 202.9 — host-only 301 gostaylo.com → airento.ru (GSC Change of Address).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-9-legacy-domain-301.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.9 — legacy gostaylo.com 301', () => {
  it('next.config redirects only legacy hosts to airento.ru with HTTP 301', () => {
    const cfg = read('next.config.js')
    const redirectsBlock = cfg.slice(cfg.indexOf('async redirects()'), cfg.indexOf('async rewrites()'))
    assert.match(redirectsBlock, /gostaylo\.com/)
    assert.match(redirectsBlock, /www\.gostaylo\.com/)
    assert.match(redirectsBlock, /https:\/\/airento\.ru\/:path\*/)
    assert.match(redirectsBlock, /statusCode:\s*301/)
    assert.doesNotMatch(redirectsBlock, /permanent:\s*true/)
    assert.match(redirectsBlock, /type:\s*['"]host['"]/)
  })

  it('does not hardcode redirect for airento.ru host', () => {
    const cfg = read('next.config.js')
    const redirectsBlock = cfg.slice(cfg.indexOf('async redirects()'), cfg.indexOf('async rewrites()'))
    assert.doesNotMatch(redirectsBlock, /value:\s*['"]airento\.ru['"]/)
    assert.doesNotMatch(redirectsBlock, /value:\s*['"]www\.airento\.ru['"]/)
  })
})
