/**
 * electron-builder.config.js
 * Production packaging configuration for Teli Attendance Desktop.
 *
 * Build commands:
 *   npm run build          → full build + NSIS installer (.exe)
 *   npm run build:unpack   → build without installer (for testing)
 *   npm run build:dir      → same as unpack
 */

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.teli.attendance',
  productName: 'Teli Attendance',
  copyright: `Copyright © ${new Date().getFullYear()} Teli Systems`,

  // ─── Directories ───────────────────────────────────────────────────────────
  directories: {
    output: 'dist-installer',
    buildResources: 'assets',
  },

  // ─── Files to bundle ───────────────────────────────────────────────────────
  files: [
    'dist/**',
    'dist-electron/**',
    'public/models/**',   // face-api model weights
    '!node_modules/**',
    '!src/**',
  ],

  // ─── Windows ───────────────────────────────────────────────────────────────
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },   // standard installer
      { target: 'portable', arch: ['x64'] }, // portable .exe (no install needed)
    ],
    icon: 'assets/icon.ico',
    artifactName: 'TeliAttendance-${version}-${arch}.${ext}',
    // requestedExecutionLevel: 'requireAdministrator' // uncomment if DB needs admin
  },

  // ─── NSIS Installer options ─────────────────────────────────────────────────
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Teli Attendance',
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeader: 'assets/installer-header.bmp',  // optional, 150x57 BMP
    license: 'LICENSE.txt',
    deleteAppDataOnUninstall: false,    // keep DB on uninstall
  },

  // ─── Auto-update ────────────────────────────────────────────────────────────
  // Uncomment and set your update server URL when ready:
  // publish: {
  //   provider: 'generic',
  //   url: 'https://updates.teli.example.com/desktop',
  // },

  // ─── Extra resources bundled at runtime ─────────────────────────────────────
  extraResources: [
    { from: 'assets/', to: 'assets/', filter: ['**/*'] },
  ],

  // ─── Mac (future) ────────────────────────────────────────────────────────────
  mac: {
    target: 'dmg',
    icon: 'assets/icon.icns',
    category: 'public.app-category.education',
  },
}
