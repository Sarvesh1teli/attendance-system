# Teli Attendance — Desktop Application

Generic Face Recognition Attendance Management System for educational institutions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 30 |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Local Database | SQLite (better-sqlite3) |
| ORM | Drizzle ORM |
| Migrations | Versioned SQL files |
| Secure Storage | Electron safeStorage |
| Auto Update | electron-updater |

---

## Prerequisites

### Required
- **Node.js 20+** (LTS recommended — avoid Node 22 for native modules)
- **Python 3.x** (for node-gyp)
- **Visual Studio Build Tools 2022** with "Desktop development with C++" workload
  - OR install via: `npm install --global windows-build-tools` (run as Administrator)

### Install Build Tools (Windows)

Option A — Visual Studio Installer:
1. Download [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. Select **Desktop development with C++**
3. Install and restart

Option B — via npm (run PowerShell as Administrator):
```powershell
npm install --global windows-build-tools
```

---

## Setup

```powershell
# From the desktop/ directory
npm install

# Rebuild better-sqlite3 for Electron
npx electron-rebuild -f -w better-sqlite3
```

---

## Development

```powershell
npm run dev
```

This starts:
- Vite dev server for the React renderer
- Electron main process with hot reload

The SQLite database is created automatically at first launch:
- **Dev:** `<project-root>/../../data/attendance.db`
- **Production (Windows):** `C:\ProgramData\TeliAttendance\data\attendance.db`

---

## Database Migrations

Migrations run automatically at app startup.

To add a new migration:
1. Create `src/main/database/migration-files/007_your_description.sql`
2. Write SQL in the file
3. Restart the app — it applies automatically

Migration files applied so far:
- `001_institution_and_config.sql` — Institution, configuration, app users
- `002_academic_structure.sql` — Departments, programs, batches, years, semesters, subjects
- `003_people.sql` — Faculty, students, enrollments
- `004_groups_and_topics.sql` — Student groups, memberships, topics
- `005_attendance_core.sql` — Sessions, session students, attendance records
- `006_face_device_ops.sql` — Face enrollment, devices, audit, sync, notifications, backup

---

## Project Structure

```
src/
  main/                    ← Node.js main process (Electron)
    index.ts               ← App entry, window creation
    preload.ts             ← contextBridge API exposure
    database/
      db.ts                ← Single SQLite connection singleton
      migrations.ts        ← Migration runner
      migration-files/     ← Versioned SQL migration files
    ipc/
      types.ts             ← Full typed IPC contract (shared)
      handlers.ts          ← ipcMain.handle() registrations
    repositories/          ← Data access layer (SQLite implementations)
    services/              ← Business logic (coming Phase 1)
    sync/                  ← Cloud sync service (coming Phase 4)
    backup/                ← Backup service (coming Phase 9)

  renderer/                ← React frontend
    main.tsx               ← React entry point
    App.tsx                ← Router
    global.d.ts            ← window.api type augmentation
    layouts/               ← MainLayout, SetupLayout
    components/            ← Shared UI components
    pages/                 ← Page components
    lib/utils.ts           ← Utility functions
    styles/globals.css     ← Tailwind + CSS variables
```

---

## Architecture Rules

1. **One SQLite connection** — `db.ts` exports a singleton. Never open a second connection.
2. **No DB in renderer** — Renderer uses `window.api.*` only. Never imports better-sqlite3.
3. **Repository pattern** — Services call repositories. Repositories call SQLite. Never skip layers.
4. **IPC typed contract** — All channels are defined in `ipc/types.ts`. Both sides use this type.
5. **Migrations only** — Never alter the DB schema outside a versioned migration file.
6. **Safe backup** — Use `db.backup()` (Online Backup API). Never `fs.copyFile()` a live DB.

---

## Build

```powershell
npm run build
```

Output goes to `release/` — an NSIS installer for Windows.

---

## Troubleshooting

### `better-sqlite3` build fails
Run after `npm install`:
```powershell
npx electron-rebuild -f -w better-sqlite3
```
If that fails, ensure Visual Studio Build Tools are installed with C++ workload.

### App shows blank screen
Check DevTools console (opens automatically in dev mode) for errors.

### Database not found
Check that `initializeDatabase()` completed without error in the main process log.
