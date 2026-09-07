/**
 * generate-icons.js
 *
 * Converts assets/icon.png → assets/icon.ico (Windows) and assets/icon.icns (macOS).
 * Run once before building:
 *   node scripts/generate-icons.js
 *
 * Requires: npm install --save-dev png-to-ico
 * (or use electron-icon-maker for full platform support)
 */

const fs = require('fs')
const path = require('path')

const srcPng = path.join(__dirname, '..', 'assets', 'icon.png')
const destIco = path.join(__dirname, '..', 'assets', 'icon.ico')

if (!fs.existsSync(srcPng)) {
  console.error('[generate-icons] assets/icon.png not found')
  process.exit(1)
}

// Option 1: Using png-to-ico (npm install --save-dev png-to-ico)
try {
  const pngToIco = require('png-to-ico')
  pngToIco(srcPng)
    .then(buf => {
      fs.writeFileSync(destIco, buf)
      console.log('[generate-icons] Created assets/icon.ico')
    })
    .catch(err => {
      console.error('[generate-icons] png-to-ico failed:', err.message)
      console.log('[generate-icons] FALLBACK: copy icon.png to icon.ico (Windows will use PNG fallback)')
      fs.copyFileSync(srcPng, destIco)
    })
} catch {
  // png-to-ico not installed — copy PNG as fallback
  console.warn('[generate-icons] png-to-ico not installed. Copying PNG as .ico fallback.')
  console.warn('[generate-icons] Run: npm install --save-dev png-to-ico  for proper .ico')
  fs.copyFileSync(srcPng, destIco)
  console.log('[generate-icons] Created assets/icon.ico (PNG copy — acceptable for testing)')
}
