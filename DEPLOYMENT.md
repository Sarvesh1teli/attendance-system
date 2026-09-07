# Teli Attendance — Deployment Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Each Institution (On-Premises)                              │
│  ┌──────────────────────────────────────────┐               │
│  │  Desktop App (Electron)       Port: local │               │
│  │  • SQLite database                        │               │
│  │  • Face recognition (local)               │               │
│  │  • Timetable & sessions                   │               │
│  └──────────────────┬───────────────────────┘               │
│                     │ HTTPS sync (periodic)                  │
└─────────────────────┼───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  Cloud Server                                                │
│  ┌─────────────────────┐   ┌──────────────────────────────┐ │
│  │  Spring Boot API    │   │  Teacher PWA (Nginx)         │ │
│  │  Port: 8086         │   │  Port: 80                    │ │
│  └──────────┬──────────┘   └──────────────────────────────┘ │
│  ┌──────────▼──────────┐                                     │
│  │  PostgreSQL 16      │                                     │
│  └─────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Desktop App — Build & Install

### Prerequisites
- Node.js 20+
- Windows 10/11 x64

### First-time setup

```powershell
cd C:\git_project\attendance-system\desktop

# Install dependencies
npm install

# Copy face recognition model weights
npm run copy-models

# Generate app icon (.ico from .png)
npm install --save-dev png-to-ico
npm run generate-icons
```

### Build installer

```powershell
# Full installer (.exe) — outputs to desktop\dist-installer\
npm run build

# Quick test build (no installer, just unpacked folder)
npm run build:unpack
```

### Distribute

Send `TeliAttendance-1.0.0-x64.exe` to faculty.
Faculty runs it → follows setup wizard → app installs to:
- Program: `C:\Program Files\Teli Attendance\`
- Data (DB): `C:\ProgramData\TeliAttendance\data\attendance.db`

### First-run checklist (after install)

1. Open **Teli Attendance**
2. Go to **Settings → Institution** — fill in institution name & code
3. Go to **Settings → Cloud Sync** — enter the Cloud API URL (`http://YOUR_SERVER:8086`)
4. Go to **Academic → Batches** — create programs, departments, batches
5. Go to **People → Students** — import or add students
6. Go to **Face Enrollment** — enroll students' faces (3–5 photos each)
7. Go to **Timetable** — set up weekly recurring schedule
8. Click **Generate Today's Sessions** to create attendance sessions

---

## 2. Cloud Server — Docker Deployment

### Prerequisites
- Docker 24+ and Docker Compose v2
- Linux server (Ubuntu 22.04 recommended)
- Port 8086 open in firewall

### Setup

```bash
# Clone the repository on the server
git clone https://github.com/your-org/attendance-system.git
cd attendance-system

# Copy and configure environment
cp .env.example .env
nano .env   # Set DB_PASS to a strong password

# Build the Teacher PWA first (needed by Nginx)
cd teacher-pwa
npm install
npm run build
cd ..

# Start everything
docker compose up -d --build

# Check status
docker compose ps
docker compose logs -f api
```

### Health check

```bash
curl http://localhost:8086/actuator/health
# Expected: {"status":"UP"}
```

### Stop / Restart

```bash
docker compose down          # stop containers (data preserved)
docker compose down -v       # stop + delete DB volume (DESTRUCTIVE)
docker compose restart api   # restart only the API
```

---

## 3. Teacher PWA

The PWA is served automatically by Nginx at `http://YOUR_SERVER:80` after running `docker compose up`.

Teachers open it on any device (phone, tablet) via browser.

### Manual serve (without Docker)

```bash
cd teacher-pwa
npm install
npm run build
npx serve dist -p 5179   # or copy dist/ to any web server
```

---

## 4. Database Backup

### Desktop SQLite backup

```powershell
# Copy DB file while app is closed
Copy-Item "C:\ProgramData\TeliAttendance\data\attendance.db" `
          "D:\Backups\attendance-$(Get-Date -Format 'yyyy-MM-dd').db"
```

### PostgreSQL backup (cloud)

```bash
# Dump
docker exec teli_db pg_dump -U teli attendance > backup-$(date +%F).sql

# Restore
docker exec -i teli_db psql -U teli attendance < backup-2024-01-15.sql
```

---

## 5. Auto-Updates (Desktop)

> Currently configured for manual builds. To enable auto-updates:

1. Host a static file server (S3, Nginx, GitHub Releases)
2. Uncomment the `publish` block in [`electron-builder.config.js`](desktop/electron-builder.config.js)
3. Set your update server URL
4. Build and upload: `npm run build`
5. Users get a silent notification when update is downloaded and will be installed on next quit

---

## 6. Port Reference

| Port | Service | Notes |
|------|---------|-------|
| `8086` | Spring Boot Cloud API | Exposed to internet, HTTPS recommended |
| `80` | Teacher PWA (Nginx) | Exposed to LAN/internet |
| `5178` | Desktop Dev Server | Dev only, not used in production |
| `5179` | PWA Dev Server | Dev only, not used in production |
| `5432` | PostgreSQL | Internal only (not exposed outside Docker network) |

---

## 7. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_NAME` | `attendance` | PostgreSQL database name |
| `DB_USER` | `teli` | Database user |
| `DB_PASS` | *(must set)* | Database password — use a strong random string |
| `API_PORT` | `8086` | External port for the Spring Boot API |
| `PWA_PORT` | `80` | External port for the Teacher PWA |

---

## 8. SMS Integration (Teli Gateway)

When you're ready to integrate the Teli Gateway SMS app:

1. Open [`desktop/src/main/services/SmsService.ts`](desktop/src/main/services/SmsService.ts)
2. Fill in the `sendSms()` method with your Teli Gateway HTTP endpoint
3. In **Settings → Config**, set `teli_gateway_url` to your gateway's local address
4. Parent shortage alerts will then be sent automatically when shortage scan runs

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| App won't start — database error | Delete `attendance.db` and restart (dev only) |
| Face models not found | Run `npm run copy-models` before starting |
| Sync not working | Check Cloud API URL in Settings → Cloud Sync |
| Docker API not starting | Check `docker compose logs api` — usually DB not ready yet |
| NSIS installer blocked | Right-click → "Run as Administrator" |
| `better-sqlite3` node ABI error | Run `npm run rebuild-sqlite` |

---

*Generated by Teli Attendance System — Phase 11 Production Build*
