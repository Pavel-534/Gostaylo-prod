#!/usr/bin/env node
/**
 * Guard for intermittent Next.js ENOENT on _ssgManifest.js write.
 * Runs "next build", and retries once after cleaning ".next/static"
 * when the known transient error signature is detected.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const NEXT_BIN = path.join(ROOT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next')
const NEXT_STATIC_DIR = path.join(ROOT_DIR, '.next', 'static')

const SSG_MANIFEST_ENOENT_RE = /ENOENT[\s\S]*_ssgManifest\.js/i

function runNextBuildOnce() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [NEXT_BIN, 'build'], {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    let combinedOutput = ''

    child.stdout.on('data', (chunk) => {
      const text = String(chunk)
      combinedOutput += text
      process.stdout.write(chunk)
    })

    child.stderr.on('data', (chunk) => {
      const text = String(chunk)
      combinedOutput += text
      process.stderr.write(chunk)
    })

    child.on('close', (code) => {
      resolve({ code: code ?? 1, output: combinedOutput })
    })
  })
}

function cleanupNextStaticDir() {
  try {
    fs.rmSync(NEXT_STATIC_DIR, { recursive: true, force: true })
  } catch (error) {
    console.warn('[next-build-resilient] failed to clean .next/static:', error?.message || error)
  }
}

async function main() {
  const first = await runNextBuildOnce()
  if (first.code === 0) {
    process.exit(0)
    return
  }

  const shouldRetry = SSG_MANIFEST_ENOENT_RE.test(first.output)
  if (!shouldRetry) {
    process.exit(first.code)
    return
  }

  console.warn('[next-build-resilient] detected transient _ssgManifest ENOENT, retrying once...')
  cleanupNextStaticDir()
  const second = await runNextBuildOnce()
  process.exit(second.code)
}

main()
