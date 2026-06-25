import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'public/icons/icon-512x512.svg'))
const outDir = path.join(root, 'public/icons')

const targets = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 72, name: 'badge-72x72.png' },
]

for (const { size, name } of targets) {
  await sharp(svg).resize(size, size).png().toFile(path.join(outDir, name))
  console.log('wrote', name)
}
