/**
 * Stage 210.4 — Concierge Supply Slice 4 (media rehost + Drive guard).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage210-4-concierge-media.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

/** Minimal JPEG-ish buffer (>64 bytes) for upload validation */
function fakeJpegBuffer() {
  const buf = Buffer.alloc(128, 0)
  buf[0] = 0xff
  buf[1] = 0xd8
  buf[2] = 0xff
  return buf
}

function makeMockDb(handlers) {
  return {
    from(table) {
      const h = handlers[table] || {}
      const state = {
        table,
        filters: [],
        inFilters: [],
        payload: null,
        op: 'select',
      }
      const chain = {
        select() {
          if (state.op !== 'update' && state.op !== 'insert') state.op = 'select'
          return chain
        },
        insert(payload) {
          state.op = 'insert'
          state.payload = payload
          return chain
        },
        update(payload) {
          state.op = 'update'
          state.payload = payload
          return chain
        },
        eq(col, val) {
          state.filters.push({ col, val })
          return chain
        },
        in(col, vals) {
          state.inFilters.push({ col, vals })
          return chain
        },
        limit() {
          return chain
        },
        maybeSingle: async () => {
          if (typeof h.maybeSingle === 'function') return h.maybeSingle(state)
          return { data: null, error: null }
        },
        then(resolve, reject) {
          const run = async () => {
            if (typeof h.execute === 'function') return h.execute(state)
            return { data: [], error: null }
          }
          return run().then(resolve, reject)
        },
      }
      return chain
    },
  }
}

describe('Stage 210.4 — Drive guard', () => {
  it('skips Drive folder/view URLs and keeps direct https images', async () => {
    const {
      isGoogleDriveFolderOrViewUrl,
      filterConciergeImagesWithDriveGuard,
    } = await import('../lib/services/concierge/concierge-media.service.js')

    assert.equal(
      isGoogleDriveFolderOrViewUrl('https://drive.google.com/drive/folders/abc123'),
      true,
    )
    assert.equal(
      isGoogleDriveFolderOrViewUrl('https://drive.google.com/file/d/xyz/view?usp=sharing'),
      true,
    )
    assert.equal(
      isGoogleDriveFolderOrViewUrl('https://drive.google.com/uc?export=download&id=xyz'),
      false,
    )

    const { images, mediaWarnings } = filterConciergeImagesWithDriveGuard([
      'https://cdn.example/a.jpg',
      'https://drive.google.com/drive/folders/abc',
      'http://insecure.example/b.jpg',
    ])
    assert.deepEqual(images, ['https://cdn.example/a.jpg'])
    assert.equal(mediaWarnings.length, 2)
    assert.equal(mediaWarnings[0].code, 'DRIVE_FOLDER_OR_VIEW')
    assert.equal(mediaWarnings[1].code, 'NON_HTTPS_IMAGE')
  })
})

describe('Stage 210.4 — rehost mock fetch + storage', () => {
  it('downloads image, uploads to listing-images/concierge/..., updates listings.images', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'

    const { rehostConciergeListingImages, uploadConciergeExternalImage } = await import(
      '../lib/services/concierge/concierge-media.service.js'
    )

    const external = 'https://cdn.partner.example/villa.jpg'
    const jpeg = fakeJpegBuffer()
    const uploaded = []

    const fetchImpl = async (url) => {
      assert.equal(url, external)
      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            if (name === 'content-type') return 'image/jpeg'
            if (name === 'content-length') return String(jpeg.length)
            return null
          },
        },
        arrayBuffer: async () => {
          const ab = new ArrayBuffer(jpeg.length)
          new Uint8Array(ab).set(jpeg)
          return ab
        },
      }
    }

    const storageClient = {
      storage: {
        from(bucket) {
          assert.equal(bucket, 'listing-images')
          return {
            upload: async (objectPath, buf, opts) => {
              uploaded.push({ objectPath, size: buf.length, contentType: opts.contentType })
              assert.match(objectPath, /^concierge\/listing-1\/[a-f0-9]+\.jpg$/)
              assert.equal(opts.contentType, 'image/jpeg')
              return { data: { path: objectPath }, error: null }
            },
            getPublicUrl: (objectPath) => ({
              data: {
                publicUrl: `https://supabase.test/storage/v1/object/public/listing-images/${objectPath}`,
              },
            }),
          }
        },
      },
    }

    let listingUpdate = null
    const db = makeMockDb({
      listings: {
        execute: async (state) => {
          if (state.op === 'update') {
            listingUpdate = state.payload
            return { data: null, error: null }
          }
          return { data: [], error: null }
        },
      },
    })

    const result = await rehostConciergeListingImages(
      {
        id: 'listing-1',
        images: [external, 'https://drive.google.com/drive/folders/skip-me'],
        cover_image: external,
      },
      {
        db,
        uploadFn: (url, listingId) =>
          uploadConciergeExternalImage(url, listingId, { fetchImpl, storageClient }),
      },
    )

    assert.equal(result.ok, true)
    assert.equal(result.updated, true)
    assert.equal(result.updatedImagesCount, 1)
    assert.equal(uploaded.length, 1)
    assert.ok(listingUpdate)
    assert.equal(listingUpdate.images.length, 1)
    assert.match(listingUpdate.images[0], /\/_storage\/listing-images\/concierge\/listing-1\//)
    assert.equal(listingUpdate.cover_image, listingUpdate.images[0])
    assert.ok(result.errors.some((e) => e.code === 'DRIVE_FOLDER_OR_VIEW'))
  })

  it('keeps original URL when download fails (does not fail whole listing)', async () => {
    const { rehostConciergeListingImages } = await import(
      '../lib/services/concierge/concierge-media.service.js'
    )
    const bad = 'https://cdn.example/missing.jpg'
    let listingUpdate = null
    const db = makeMockDb({
      listings: {
        execute: async (state) => {
          if (state.op === 'update') {
            listingUpdate = state.payload
            return { data: null, error: null }
          }
          return { data: [], error: null }
        },
      },
    })

    const result = await rehostConciergeListingImages(
      { id: 'listing-2', images: [bad] },
      {
        db,
        uploadFn: async () => ({ success: false, error: 'HTTP 404' }),
      },
    )

    assert.equal(result.ok, true)
    assert.equal(result.updatedImagesCount, 0)
    assert.equal(result.errors.length, 1)
    assert.equal(listingUpdate.images[0], bad)
  })
})

describe('Stage 210.4 — route + ingest wiring', () => {
  it('admin rehost-media route and ingest autoRehostMedia flag exist', () => {
    const route = read('app/api/v2/admin/concierge/rehost-media/route.js')
    assert.match(route, /rehostConciergeMedia/)
    assert.match(route, /ADMIN/)

    const ingest = read('app/api/v2/admin/concierge/ingest/route.js')
    assert.match(ingest, /autoRehostMedia/)

    const supply = read('lib/services/concierge/concierge-supply.service.js')
    assert.match(supply, /autoRehostMedia/)
    assert.match(supply, /media_warnings/)
    assert.match(supply, /rehostConciergeMedia/)

    const playbook = read('docs/runbooks/CONCIERGE_DRIVE_MEDIA_PLAYBOOK.md')
    assert.match(playbook, /Google Drive/)
    assert.match(playbook, /listing-images/)
  })
})
