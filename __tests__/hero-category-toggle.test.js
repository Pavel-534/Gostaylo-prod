/**
 * Home hero category chips: tap selects, same-chip tap clears to all.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/hero-category-toggle.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const { nextHeroCategorySelection } = require('../lib/home/hero-category-tabs.js')

describe('nextHeroCategorySelection', () => {
  it('selects a category from all', () => {
    assert.equal(nextHeroCategorySelection('all', 'property'), 'property')
    assert.equal(nextHeroCategorySelection('', 'tours'), 'tours')
  })

  it('toggles the same category off to all', () => {
    assert.equal(nextHeroCategorySelection('property', 'property'), 'all')
    assert.equal(nextHeroCategorySelection('tours', 'tours'), 'all')
  })

  it('switches to a different category', () => {
    assert.equal(nextHeroCategorySelection('property', 'tours'), 'tours')
  })
})

describe('home hero wires toggle', () => {
  it('handleCategoryTabClick uses nextHeroCategorySelection', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'hooks/home/use-platform-home-page.js'), 'utf8')
    assert.match(src, /nextHeroCategorySelection/)
  })
})
