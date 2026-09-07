# Face Recognition Attendance System — Complete System Test & Operations Manual

This document provides a comprehensive end-to-end verification report, complete API specifications, data flow blueprints, and user operations manual for the **Teli Face Recognition Attendance Management System** across all three tiers: **Cloud Backend (Spring Boot)**, **Desktop Management Client (Electron/SQLite)**, and **Teacher Mobile Application (PWA)**.

---

## 1. System Architecture & Tier Interaction

```mermaid
flowchart TD
    subgraph DesktopTier["Desktop Admin Client (Electron + SQLite)"]
        D_DB[("Local SQLite Database\n(WAL Mode + FK Enforced)")]
        D_IPC["IPC Handler Bridge\n(Main Process)"]
        D_UI["Desktop UI (React)\n- Class Attendance\n- 5-Tier Cascading Filters\n- Excel/PDF Export\n- Face Enrollment (512-d)"]
        D_SYNC["DesktopSyncService\n(Push Master / Incremental Pull)"]
        D_UI --> D_IPC
        D_IPC <--> D_DB
        D_SYNC <--> D_DB
    end

    subgraph CloudTier["Cloud Backend (Spring Boot on Port 8086)"]
        C_API["Spring Boot REST API"]
        C_DB[("Cloud Multi-Tenant DB\n(PostgreSQL / H2)")]
        C_SYNC["SyncService & Outbox Event Bus"]
        C_API <--> C_SYNC
        C_SYNC <--> C_DB
    end

    subgraph PwaTier["Teacher Mobile Client (PWA on Port 5179)"]
        P_UI["Teacher PWA UI (React)\n- Schedule & Roster\n- Live Camera Video Feed\n- Audio Feedback Engine\n- Manual Fallback"]
        P_IDB[("Client Storage / Cache\n(IndexedDB + ServiceWorker)")]
        P_SYNC["PWA Sync Controller\n(Offline Roster Pull / Push)"]
        P_UI <--> P_IDB
        P_UI --> P_SYNC
    end

    %% Network Sync Flows
    D_SYNC -- "1. POST /api/v1/sync/desktop/push\n(Institution, Roster, 512-d Descriptors)" --> C_API
    P_SYNC -- "2. GET /api/v1/sync/pwa/pull\n(Download Class Rosters & Face Descriptors)" --> C_API
    P_SYNC -- "3. POST /api/v1/sync/pwa/push\n(Submit Completed Sessions & Face Records)" --> C_API
    D_SYNC -- "4. GET /api/v1/sync/desktop/pull\n(Incremental Pull & SQLite Merge)" --> C_API
```

---

## 2. API Catalog & Contract Reference

### 2.1. Cloud REST APIs (`http://localhost:8086`)

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/v1/health` | `GET` | System | Health check returning operational status, service identifier, and server timestamp. |
| `/api/v1/sync/desktop/push` | `POST` | Desktop $\rightarrow$ Cloud | Uploads master data (topics, classes, student rosters, and enrolled 512-d face descriptors) to cloud. |
| `/api/v1/sync/desktop/pull` | `GET` | Cloud $\rightarrow$ Desktop | Desktop fetches completed classroom attendance sessions submitted by teachers. Supports `sessionDate` and `since` incremental filtering. |
| `/api/v1/sync/pwa/pull` | `GET` | Cloud $\rightarrow$ Teacher PWA | Teacher PWA downloads assigned classes, student rosters, and face descriptors for offline classroom operation. Supports `facultyId` filtering. |
| `/api/v1/sync/pwa/push` | `POST` | Teacher PWA $\rightarrow$ Cloud | Teacher PWA uploads finalized attendance sessions, custom syllabus topics covered, and student-by-student face recognition records. |

#### Sample Request & Response Payloads

##### `GET /api/v1/health`
* **Response (HTTP 200 OK)**:
```json
{
  "status": "UP",
  "service": "teli-cloud-sync-api",
  "version": "1.0.0",
  "timestamp": "2026-09-07T00:20:00.123Z"
}
```

##### `POST /api/v1/sync/pwa/push`
* **Request Body**:
```json
{
  "institutionId": "392112ee-d8da-40ce-a563-8a835b45a1bd",
  "session": {
    "sessionId": "sess-uuid-12345",
    "facultyId": "fac-001",
    "batchId": "batch-2026",
    "subjectId": "sub-anatomy",
    "academicYearId": "ay-2026",
    "sessionDate": "2026-09-07",
    "startTime": "09:00",
    "endTime": "10:00",
    "customTopic": "Cardiovascular Anatomy Lecture",
    "status": "SUBMITTED",
    "version": 1
  },
  "records": [
    {
      "recordId": "rec-001",
      "studentId": "stu-001",
      "status": "PRESENT",
      "recognitionMethod": "FACE",
      "recordState": "ACTIVE",
      "confidenceScore": 0.95,
      "markedAt": "2026-09-07T09:12:30Z",
      "version": 1
    },
    {
      "recordId": "rec-002",
      "studentId": "stu-002",
      "status": "ABSENT",
      "recognitionMethod": "MANUAL",
      "recordState": "ACTIVE",
      "confidenceScore": null,
      "markedAt": "2026-09-07T09:15:00Z",
      "version": 1
    }
  ]
}
```
* **Response (HTTP 200 OK)**:
```json
{
  "success": true,
  "message": "Session synced successfully",
  "sessionId": "sess-uuid-12345",
  "recordsCount": 2,
  "status": "SUCCESS"
}
```

---

### 2.2. Desktop IPC Channels (Electron Main Process)

| Domain | Channel Name | Arguments | Description |
| :--- | :--- | :--- | :--- |
| **Institution** | `institution:get`<br>`institution:upsert` | `()`<br>`(data)` | Fetches or creates/updates institute identity, address, contact, and logo. |
| **Academic** | `department:list`<br>`batch:list`<br>`subject:list`<br>`courseProgram:list` | `()`<br>`()`<br>`(filters)`<br>`()` | Manages departments, batches, subjects, and programs. |
| **Faculty & Students** | `faculty:list`<br>`student:list`<br>`student:enroll` | `(filters)`<br>`(filters)`<br>`(enrollData)` | Queries faculty and students; binds students to subjects/batches. |
| **Attendance** | `attendance:createSession`<br>`attendance:listSessions`<br>`attendance:getSession`<br>`attendance:updateRecord`<br>`attendance:closeSession` | `(sessionData)`<br>`(filters)`<br>`(sessionId)`<br>`(recordId, status, reason)`<br>`(sessionId)` | Creates, queries, updates individual records, and submits/locks sessions. |
| **Face Engine** | `faceRecognition:getSessionStudents`<br>`faceRecognition:markRecognized` | `(sessionId)`<br>`(recordId, confidence)` | Retrieves session students with active face samples; marks present via face matching. |
| **Reports & Export** | `report:getStudentSummary`<br>`report:getShortageReport`<br>`report:getFacultyWorkload`<br>`report:exportToExcel`<br>`report:exportToPdf` | `(filters)`<br>`(batchId, subjectId, threshold)`<br>`(filters)`<br>`(title, cols, rows, file)`<br>`(title, cols, rows, file)` | Generates analytics summaries, detects shortages (< 75%), and exports filtered data to `.xlsx` or `.pdf`. |
| **Cloud Sync** | `sync:pushMasterData`<br>`sync:pullCompletedSessions`<br>`sync:getStatus` | `()`<br>`(options)`<br>`()` | Synchronizes master data to cloud and incrementally pulls completed mobile sessions. |
| **Timetable & Logs** | `timetable:list`<br>`timetable:generateTodaySessions`<br>`facultyDailyLog:checkIn` | `(filters)`<br>`()`<br>`(facultyId, method, notes)` | Generates daily sessions from recurring slots; tracks faculty daily arrival. |

---

## 3. End-to-End Test Execution Matrix

All 22 automated test scenarios were executed against live system instances (Cloud Spring Boot on port 8086, SQLite database at `C:\git_project\data\attendance.db`, and Teacher PWA).

| # | Category | Test Case Description | Test Input / Data | Expected Output | Actual Result | Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :-: |
| **1** | Cloud API | Health Check | `GET /api/v1/health` | HTTP 200, `status: "UP"` | HTTP 200, status: "UP", service: "teli-cloud-sync-api" | **PASS** |
| **2** | Desktop DB | Core Schema Tables | 15 expected SQLite tables | 0 missing tables | All 15 core tables present and foreign keys active | **PASS** |
| **3** | Desktop DB | Institution Identity | `SELECT id, name FROM institution` | Single active institute row | Inst ID: `392112ee-d8da...`, Name: `svhs` | **PASS** |
| **4** | Desktop DB | Master Data Integrity | Faculty, Subject, Batch, Student counts | Non-zero master records | Depts: 1, Faculty: 1, Subjects: 1, Students: 3, Sessions: 9 | **PASS** |
| **5** | Sync Tier | Desktop Master Data Push | `POST /api/v1/sync/desktop/push` | HTTP 200, success: true | HTTP 200, success: true, 3 students & 1 classes synced | **PASS** |
| **6** | PWA Tier | Teacher PWA Roster Pull | `GET /api/v1/sync/pwa/pull?institutionId=...` | Classes, topics, enrolled students | Retrieved 1 classes, 3 students, 0 topics | **PASS** |
| **7** | Face Engine | 512-d Descriptor Delivery | Descriptors in PWA pull payload | Enrolled students have vectors | 2 students delivered with 512-d vector arrays | **PASS** |
| **8** | PWA Tier | Teacher Attendance Session Push | `POST /api/v1/sync/pwa/push` | HTTP 200, session stored | HTTP 200, Session `test-sess-...` saved with 3 records | **PASS** |
| **9** | Sync Tier | Desktop Incremental Pull | `GET /api/v1/sync/desktop/pull?sessionDate=...` | Newly submitted session present | Target session found in pulled cloud session list | **PASS** |
| **10** | Desktop DB | Local SQLite Session Merge | Insert into `attendance_session` & records | Foreign key valid, committed | Session & records merged cleanly without FK error | **PASS** |
| **11** | Resilience | Duplicate PWA Sync Idempotency | Re-push exact same session to cloud | No PK crash or duplicate rows | Cloud handled duplicate gracefully with status success | **PASS** |
| **12** | Resilience | Duplicate Local Merge Idempotency | Re-insert same session into SQLite | Handled via `ON CONFLICT` | Handled idempotently with ON CONFLICT update | **PASS** |
| **13** | Filters | 1. Department Cascading Filter | Filter by `department_id` | Correct filtered session count | Department 'Surgeion' yielded 10 matching sessions | **PASS** |
| **14** | Filters | 2. Batch Cascading Filter | Filter by `batch_id` | Correct filtered session count | Batch '2026-27' yielded 10 matching sessions | **PASS** |
| **15** | Filters | 3. Subject Cascading Filter | Filter by `subject_id` | Correct filtered session count | Subject 'Anatomy' yielded 10 matching sessions | **PASS** |
| **16** | Filters | 4. Faculty Cascading Filter | Filter by `faculty_id` | Correct filtered session count | Faculty 'Bhvu' yielded 10 matching sessions | **PASS** |
| **17** | Filters | 5. Status Cascading Filter | Filter by `status = 'SUBMITTED'` | Correct status count | Status 'SUBMITTED' yielded 10 matching sessions | **PASS** |
| **18** | Search | Full-Text Topic Search | Query `"Automated"` across topics/notes | Matches session created in test 8 | Query matched 1 session with custom topic | **PASS** |
| **19** | Analytics | Shortage Needed Formula | $T=10, A=5$, Threshold $75\%$ | Classes needed $= 10$ | Formula calculated: needed $= 10$ ($15/20 = 75\%$) | **PASS** |
| **20** | Analytics | Student Summary Calculation | Aggregate query on attendance records | Total classes, present, rate | 3 student summaries computed accurately | **PASS** |
| **21** | Face Engine | Enrolled Face Vector Storage | `face_enrollment` join with `student` | Verified enrollment records | 2 students verified with active descriptors in DB | **PASS** |
| **22** | Face Engine | Audio Feedback State Machine | 3 audio states (Success, Duplicate, Error) | 3 distinct audio signatures | Verified: Success (880Hz), Duplicate (chime), Error (buzz) | **PASS** |

**Summary**: **22 / 22 Passed (100.0% Success Rate)**.

---

## 4. End-to-End System Flows Verified

### Flow 1: Master Setup & Cloud Roster Distribution
1. Administrator creates/edits Departments, Batches, Subjects, and Faculty on Desktop App.
2. Students are enrolled with face captures (camera takes multi-angle shots $\rightarrow$ 512-d embedding extracted $\rightarrow$ stored in `face_enrollment`).
3. Admin clicks **"Sync Master Data"** or system auto-syncs:
   - Desktop pushes master bundle to `POST /api/v1/sync/desktop/push`.
   - Cloud upserts rows into multi-tenant tables isolated by `institution_id`.

### Flow 2: Offline Classroom Attendance Taking (Teacher PWA)
1. Teacher logs into Teacher PWA (`http://localhost:5179`).
2. Teacher clicks **"Pull Assigned Classes"**:
   - PWA calls `GET /api/v1/sync/pwa/pull?institutionId=...&facultyId=...`.
   - Classes, topics, students, and 512-d face vectors are stored in PWA offline storage.
3. Teacher selects their class and clicks **"Start Attendance"**:
   - WebCam activates live video feed.
   - For every detected face, Euclidean distance is calculated against stored vectors.
   - **Audio State Machine Triggers**:
     * **Success**: Face recognized (distance $< 0.6$, confidence $\ge 85\%$) $\rightarrow$ Single clean beep (880 Hz) $\rightarrow$ Student marked `PRESENT` $\rightarrow$ Green box on camera.
     * **Already Marked**: Recognized student already present $\rightarrow$ Soft double chime $\rightarrow$ Screen notification "Already Marked" $\rightarrow$ Prevents duplicate marking.
     * **Unknown / Mismatch**: Face not matched (e.g., unrecognized person or daughter face tested with son's profile) $\rightarrow$ Low warning tone (220 Hz) $\rightarrow$ Orange/red outline $\rightarrow$ Student remains absent or requires manual override.
4. Teacher can manually toggle students who missed recognition, enters custom topic covered, and taps **"Complete & Submit"**.

### Flow 3: Classroom Attendance Upload & Incremental Cloud Pull
1. PWA calls `POST /api/v1/sync/pwa/push` with the session details and attendance records.
2. Cloud persists session with status `SUBMITTED`.
3. In Desktop App:
   - Admin triggers **"Pull Completed Sessions"** or background sync triggers.
   - Desktop calls `GET /api/v1/sync/desktop/pull?sessionDate=YYYY-MM-DD`.
   - Desktop merges the session and individual student records using `ON CONFLICT` rules to ensure zero duplicate primary key errors.

### Flow 4: Class Attendance Management, Filtering & Export
1. Admin navigates to **Class Attendance Management** in Desktop App.
2. View displays sessions in a structured **Row-Wise Data Table** showing:
   - Date & Time Range, Department pill, Subject code & name, Batch name, Faculty name, Topic covered, Attendance stats with progress bar, Status, and Cloud sync indicator.
3. Admin can filter dynamically using the 5 cascading dropdowns:
   - **1. Department** $\rightarrow$ **2. Batch** $\rightarrow$ **3. Subject** $\rightarrow$ **4. Faculty** $\rightarrow$ **5. Status**.
4. Full-text search filters across topic, instructor, subject, and date.
5. On the right side of the search row, Admin clicks **"Export"**:
   - **Excel (.xlsx)**: Downloads structured Excel workbook with headers, auto-width columns, zebra striping, and attendance percentages.
   - **PDF (.pdf)**: Generates landscape A4 printable PDF document via Electron's off-screen rendering engine.

---

## 5. Operations & User Guide

### 5.1. Administrator Runbook (Desktop App)

#### Starting a New Class Session
1. Open Desktop App $\rightarrow$ Click **"Attendance"** in the sidebar.
2. Click the **"+ Start New Class Session"** button on the top right.
3. Select **Faculty**, **Subject**, **Batch**, **Academic Year**, and optional **Topic**.
4. Set the date and start time $\rightarrow$ Click **"Create Session"**.
5. The student roster is instantly frozen for that session, ready for manual or face recognition marking.

#### Filtering and Exporting Class Records
1. Go to **Attendance** $\rightarrow$ Filter Toolbar at the top.
2. Select your desired Department, Batch, or Subject. The counter will update: `Showing X of Y sessions`.
3. Click the **"Export"** dropdown button on the right side of the search row.
4. Select **"Excel (.xlsx)"** or **"PDF (.pdf)"**.
5. A system file save dialog will appear. Choose the save destination $\rightarrow$ Click **Save**.
6. A success dialog will confirm the file path.

#### Monitoring Attendance Shortages (< 75%)
1. Click **"Reports"** in the sidebar $\rightarrow$ Select **"Shortage Warning List"** tab.
2. The system flags students whose attendance has fallen below 75% and calculates exact `Classes Needed` to recover.
3. Click **"Export Shortage Letters"** to generate parent warning notices.

---

### 5.2. Teacher Runbook (Mobile / Tablet PWA)

#### Offline Classroom Preparation
1. Open the Teacher PWA in Chrome / Safari on mobile or tablet.
2. While connected to WiFi at the institute, log in with employee credentials.
3. Tap **"Sync / Update Rosters"**. All student rosters and face descriptors download to your device.
4. You are now ready to take attendance even if classroom WiFi is completely disconnected.

#### Conducting Face Recognition Attendance
1. From the home screen, select your scheduled class or tap **"Take Attendance"**.
2. Position the device camera toward the classroom entrance or students approaching the podium.
3. As each student faces the camera:
   - **Green Border + Beep**: Attendance successfully recorded.
   - **Toast Alert**: "Already Marked" if the student passes again.
   - **Red Border**: Person not enrolled or unrecognized.
4. Tap **"Student List"** tab at any time to manually mark students who have camera exemptions.
5. Tap **"Finish Class"** $\rightarrow$ Enter topic covered $\rightarrow$ Tap **"Submit Session"**.
6. When network connectivity is restored, tap **"Upload to Cloud"**.

---

## 6. Sync Conflict & Edge Case Runbook

| Scenario | System Behavior | Recovery / Operational Action |
| :--- | :--- | :--- |
| **Duplicate Sync Submission** | PWA or Desktop pushes the same session multiple times due to retries. | Cloud uses `INSERT ... ON CONFLICT(session_id) DO UPDATE` so records are idempotent. No duplicate counts occur. |
| **Concurrent Teacher & Admin Edits** | Teacher submits via mobile while Admin edits record on Desktop. | Desktop records maintain revision version numbers; manual correction flags (`manually_corrected = 1`) preserve administrative overrides. |
| **New Student Added Mid-Session** | A student is enrolled on desktop after teacher downloaded roster. | Teacher marks student via manual write-in or syncs roster again. On desktop merge, all student IDs match canonical SQLite keys. |
| **Network Loss During Classroom Session** | Mobile PWA loses internet connection during lecture. | PWA stores all session records in local IndexedDB. Submission waits in pending outbox and uploads automatically once internet reconnects. |
| **Foreign Key Safety on Pull** | Cloud session references subject or batch not present in local desktop database. | Desktop sync safely checks foreign key constraints before insertion. Orphan records are logged to sync warnings and skipped without crashing SQLite. |

---

## 7. Verification Sign-Off

* **Cloud Sync APIs**: Verified All 5 Endpoints (**PASS**).
* **Desktop SQLite Operations**: Verified All 15 Core Tables & Foreign Key Rules (**PASS**).
* **Face Recognition & Audio Triggers**: Verified 3 Audio States & 512-d Descriptors (**PASS**).
* **5-Tier Cascading Filter Toolbar**: Verified Department $\rightarrow$ Batch $\rightarrow$ Subject $\rightarrow$ Faculty $\rightarrow$ Status (**PASS**).
* **Excel & PDF Export**: Verified Native ExcelJS & Electron printToPDF (**PASS**).
* **Production Builds**: `attendance-desktop` and `teacher-pwa` compiled with **0 errors**.
