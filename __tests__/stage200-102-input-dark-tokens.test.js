/**
 * Stage 200.102 — Dark Mode Input borders via semantic tokens (no slate/hex sweep).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-102-input-dark-tokens.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.102 — Input dark tokens', () => {
  it('dark --input lightness is raised above muted blend (~17%)', () => {
    const css = read('app/globals.css')
    const darkBlock = css.match(/\.dark\s*\{([\s\S]*?)\n\s*\}/)
    assert.ok(darkBlock, 'expected .dark { … } block')
    const block = darkBlock[1]
    assert.match(block, /--input:\s*215\s+16%\s+36%/)
    assert.match(block, /--border:\s*217\.2\s+20%\s+26%/)
    assert.doesNotMatch(block, /--input:\s*217\.2\s+32\.6%\s+17\.5%/)
  })

  it('Input uses border-input + brand-mint focus; no slate/hex borders', () => {
    const input = read('components/ui/input.jsx')
    assert.match(input, /border-input/)
    assert.match(input, /hover:border-ring\/45/)
    assert.match(input, /focus-visible:border-brand-mint/)
    assert.match(input, /focus-visible:ring-brand-mint\/40/)
    assert.doesNotMatch(input, /border-slate-/)
    assert.doesNotMatch(input, /border-\[#/)
    assert.doesNotMatch(input, /bg-\[#/)
  })

  it('Textarea and SelectTrigger share the same focus recipe', () => {
    const textarea = read('components/ui/textarea.jsx')
    const select = read('components/ui/select.jsx')
    assert.match(textarea, /border-input/)
    assert.match(textarea, /focus-visible:border-brand-mint/)
    assert.match(textarea, /focus-visible:ring-brand-mint\/40/)
    assert.doesNotMatch(textarea, /border-slate-/)
    assert.match(select, /border-input/)
    assert.match(select, /focus:border-brand-mint/)
    assert.match(select, /focus:ring-brand-mint\/40/)
  })
})
