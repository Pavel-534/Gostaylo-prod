/**
 * Stage 202.43 — chunk load recovery helpers.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-43-chunk-load-reload.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.43 — catalog chunk load resilience', () => {
  it('isClientNavFailure detects ChunkLoadError timeout', () => {
    const { isClientNavFailure } = require('../lib/navigation/is-client-nav-failure.js')
    assert.equal(
      isClientNavFailure({
        name: 'ChunkLoadError',
        message: 'Loading chunk 6862 failed.\n(timeout)',
      }),
      true,
    )
    assert.equal(isClientNavFailure({ message: 'boom' }), false)
  })

  it('listings error hard-reloads chunk failures; ChunkLoadResilience is eager', () => {
    const err = read('app/(storefront)/listings/error.jsx')
    assert.match(err, /hardReloadForChunkFailure/)
    assert.match(err, /location\.reload/)
    const rootProviders = read('components/providers/RootClientProviders.jsx')
    assert.match(rootProviders, /import \{ ChunkLoadResilience \}/)
    assert.match(rootProviders, /<ChunkLoadResilience \/>/)
    const deferred = read('components/providers/DeferredRootChrome.jsx')
    assert.doesNotMatch(deferred, /import \{ ChunkLoadResilience \}/)
    assert.doesNotMatch(deferred, /<ChunkLoadResilience \/>/)
  })

  it('catalog dynamic imports retry once on chunk failure', () => {
    const src = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.match(src, /importWithChunkRetry/)
    assert.match(src, /SearchMapWrapper/)
    const helper = read('lib/navigation/chunk-load-reload.js')
    assert.match(helper, /importWithChunkRetry/)
    assert.match(helper, /claimChunkGracefulReload/)
  })
})
