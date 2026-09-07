/**
 * copy-face-models.js
 *
 * Copies @vladmandic/face-api model files from node_modules into public/models/
 * so Vite can serve them as static assets at /models/ in both dev and prod.
 *
 * The package may be hoisted to the monorepo root node_modules, so we search
 * both the local desktop/node_modules and the parent root node_modules.
 *
 * Run once after npm install:
 *   node scripts/copy-face-models.js
 */

const fs = require('fs')
const path = require('path')

// Search locations: local desktop node_modules first, then monorepo root
const candidates = [
  path.join(__dirname, '..', 'node_modules', '@vladmandic', 'face-api', 'model'),
  path.join(__dirname, '..', '..', 'node_modules', '@vladmandic', 'face-api', 'model'),
]

const src = candidates.find(p => fs.existsSync(p))

if (!src) {
  console.error('[copy-face-models] Could not locate @vladmandic/face-api/model in:')
  candidates.forEach(c => console.error(' ', c))
  console.error('Run: npm install @vladmandic/face-api first')
  process.exit(1)
}

const dest = path.join(__dirname, '..', 'public', 'models')
fs.mkdirSync(dest, { recursive: true })

const files = fs.readdirSync(src)
let copied = 0

for (const file of files) {
  const srcFile = path.join(src, file)
  const destFile = path.join(dest, file)
  fs.copyFileSync(srcFile, destFile)
  console.log('[copy-face-models] Copied:', file)
  copied++
}

console.log(`\n[copy-face-models] Done — ${copied} model files copied to:\n  ${dest}`)
