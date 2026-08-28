/**
 * CI contract — smoke scripts must load @/ alias (AUDIT_02 regression).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

test('smoke:audit02 npm script uses node-test-alias-register', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.match(pkg.scripts['smoke:audit02'], /node-test-alias-register/)
})

test('audit02 workflow runs npm run smoke:audit02', () => {
  const yml = readFileSync(join(root, '.github/workflows/audit02-regression-smoke.yml'), 'utf8')
  assert.match(yml, /npm run smoke:audit02/)
})
