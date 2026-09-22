/**
 * Stage 202.48 — Vercel Functions co-located with Supabase (ap-southeast-1).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-48-vercel-supabase-colocation.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('Stage 202.48 — Vercel ↔ Supabase co-location', () => {
  it('vercel.json pins Serverless Functions to sin1 (near Supabase Singapore)', () => {
    const raw = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')
    const cfg = JSON.parse(raw)
    assert.deepEqual(cfg.regions, ['sin1'])
  })

  it('does not pin Functions to iad1 (legacy default / cross-ocean RTT)', () => {
    const raw = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')
    assert.doesNotMatch(raw, /"iad1"/)
  })
})
