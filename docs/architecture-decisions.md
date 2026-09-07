# Architecture Decisions

## Face Recognition Attendance Management System

This document records all significant architectural decisions made during the design and implementation phases.

---

## ADR-001: SQLite for Desktop, PostgreSQL for Cloud

**Date:** 2026-09-06  
**Status:** Accepted

### Decision
Use SQLite (via `better-sqlite3`) as the local database for the desktop application. Use PostgreSQL for the cloud synchronization service.

### Rationale
- SQLite requires zero installation on customer machines
- `better-sqlite3` provides a synchronous API, suitable for Electron's main process
- Customer installation is: Download → Install → Open → Ready
- PostgreSQL handles multi-tenant, multi-user cloud concurrency requirements
- SQLite can handle millions of attendance records with proper indexing

### Constraints
- All DB access must go through a single `better-sqlite3` connection in the main process
- The renderer process must never access the database directly
- `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` must be applied at startup

---

## ADR-002: Repository Pattern for DB Abstraction

**Date:** 2026-09-06  
**Status:** Accepted

### Decision
All data access goes through typed repository classes. Services never call SQL directly.

```
Service Layer → Repository Interface → SQLiteXxxRepository → better-sqlite3
```

### Rationale
- Makes SQLite → PostgreSQL migration possible without rewriting business logic
- Testable: repositories can be mocked in unit tests
- Consistent error boundary

---

## ADR-003: Typed IPC Bridge (No Direct ipcRenderer in Renderer)

**Date:** 2026-09-06  
**Status:** Accepted

### Decision
Expose a typed `window.api` object via `contextBridge` in the preload script. The renderer always calls `window.api.xxx()`. The renderer never imports or calls `ipcRenderer` directly.

### Rationale
- `contextIsolation: true` prevents renderer from accessing Node.js APIs
- Full TypeScript type safety across the IPC boundary
- Single contract file (`ipc/types.ts`) defines the complete API surface

---

## ADR-004: Option A for Absent Student Records

**Date:** 2026-09  
**Status:** Accepted (locked in specification)

### Decision
When a session opens, create `attendance_session_student` and `attendance_record` rows for **all eligible students** with `status = ABSENT` and `recognition_method = SYSTEM_DEFAULT`. Face recognition **updates** (not inserts) the existing record to PRESENT/LATE.

### Rationale
- Missing records are data integrity errors, not absence
- Simplifies reporting: no LEFT JOIN needed
- Simplifies sync: presence of a row can be assumed
- Consistent audit trail

---

## ADR-005: Group Membership Snapshot at Session Open

**Date:** 2026-09  
**Status:** Accepted (locked in specification)

### Decision
`attendance_session_student` freezes the eligible student list at the moment the session opens. Subsequent group membership changes do not affect existing sessions.

### Rationale
- Historical accuracy: a session reflects who was eligible on that day
- Prevents retroactive changes from corrupting past records

---

## ADR-006: Versioning Strategy for Sync Conflict Detection

**Date:** 2026-09  
**Status:** Accepted (locked in specification)

### Decision
Every sync-relevant record has a `version` integer starting at 1, incrementing on each update.

| Condition | Action |
|-----------|--------|
| `incoming > stored` | Candidate for update |
| `incoming = stored` AND content identical | Idempotent retry — accept |
| `incoming = stored` AND content differs | SYNC_CONFLICT |
| `incoming < stored` | Stale update — reject |

---

## ADR-007: Face Embeddings Encrypted at Rest

**Date:** 2026-09-06  
**Status:** Accepted

### Decision
Face embeddings are stored as AES-256-GCM encrypted BLOBs in SQLite. The encryption key is stored using `electron.safeStorage` (OS keychain). Face photos are never sent to the cloud.

---

## ADR-008: MediaPipe + ONNX Runtime Web for Face Recognition (Not Locked)

**Date:** 2026-09-06  
**Status:** Pending Benchmark

### Decision
Use MediaPipe for face detection/alignment/liveness and ONNX Runtime Web for embedding inference. The specific model (MobileFaceNet or equivalent) will be selected after benchmark testing.

### Constraint
**Do not finalize the model before Phase 2 benchmark results are reviewed.**

See: `docs/face-benchmark-report.md`

---

## ADR-009: PostgreSQL Outbox Pattern (No Redis Initially)

**Date:** 2026-09-06  
**Status:** Accepted

### Decision
Use a PostgreSQL `outbox_event` table for notification queuing and retry logic. Do not introduce Redis, Kafka, or RabbitMQ until actual scale requirements justify it.

---

## ADR-010: Cancelled Session Records Marked VOIDED, Never Deleted

**Date:** 2026-09  
**Status:** Accepted (locked in specification)

### Decision
When a session is cancelled, `attendance_session.status = CANCELLED` and all associated `attendance_record` rows have `record_state = VOIDED`. Physical deletion is never performed.

### Rationale
- Complete audit trail
- Regulatory compliance
- Sync safety: deletions are harder to propagate than state changes

---

## ADR-011: Spring Boot + PostgreSQL for Cloud

**Date:** 2026-09-06  
**Status:** Accepted

### Decision
The cloud synchronization API uses Java 21, Spring Boot 3.x, Spring Security (JWT RS256), Spring Data JPA, and Flyway for migrations.

### Rationale
- Mature authentication and multi-tenancy support
- Strong transaction and concurrency handling for multi-institution sync
- Separate language from desktop is acceptable: use best tool per environment

---

## ADR-012: Hybrid Multi-Tenancy

**Date:** 2026-09  
**Status:** Accepted (locked in specification)

### Decision
Each institution's desktop has its own local SQLite database. The cloud uses a shared PostgreSQL database with `institution_id` on every tenant-owned record. JWT token includes `institution_id`. Server never trusts `institution_id` from request body alone.
