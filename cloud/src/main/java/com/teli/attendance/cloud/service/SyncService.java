package com.teli.attendance.cloud.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.teli.attendance.cloud.domain.dto.*;
import com.teli.attendance.cloud.domain.entity.*;
import com.teli.attendance.cloud.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyncService {

    private final TenantInstitutionRepository tenantRepo;
    private final CloudTeacherRepository teacherRepo;
    private final CloudTopicRepository topicRepo;
    private final CloudStudentRosterRepository studentRepo;
    private final CloudClassAssignmentRepository classRepo;
    private final CloudAttendanceSessionRepository sessionRepo;
    private final CloudAttendanceRecordRepository recordRepo;
    private final CloudSyncConflictRepository conflictRepo;
    private final CloudOutboxEventRepository outboxRepo;
    private final CloudTenantEntityRepository tenantEntityRepo;
    private final ObjectMapper objectMapper;

    /**
     * Ensure tenant exists or auto-provision for seamless developer testing.
     */
    public TenantInstitution ensureTenant(String institutionId) {
        return tenantRepo.findById(institutionId).orElseGet(() -> {
            TenantInstitution newInst = TenantInstitution.builder()
                    .id(institutionId)
                    .name("Institutional Campus (" + institutionId + ")")
                    .apiKey("api-key-" + institutionId)
                    .status("ACTIVE")
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            return tenantRepo.save(newInst);
        });
    }

    /**
     * Drop all synced data across students, classes, topics, sessions, and records.
     */
    @Transactional
    public void resetAllData(String institutionId) {
        log.info("Resetting all cloud sync data for institutionId: {}", institutionId);
        if (institutionId != null && !institutionId.isBlank()) {
            tenantEntityRepo.deleteAll(tenantEntityRepo.findByInstitutionId(institutionId));
            teacherRepo.deleteAll(teacherRepo.findByInstitutionId(institutionId));
            studentRepo.deleteAll(studentRepo.findByInstitutionId(institutionId));
            classRepo.deleteAll(classRepo.findByInstitutionId(institutionId));
            topicRepo.deleteAll(topicRepo.findByInstitutionId(institutionId));
            sessionRepo.deleteAll(sessionRepo.findByInstitutionId(institutionId));
            recordRepo.deleteAll(recordRepo.findByInstitutionId(institutionId));
        } else {
            tenantEntityRepo.deleteAll();
            teacherRepo.deleteAll();
            studentRepo.deleteAll();
            classRepo.deleteAll();
            topicRepo.deleteAll();
            sessionRepo.deleteAll();
            recordRepo.deleteAll();
        }
    }

    /**
     * Process PWA Push: Receives session and attendance records from Teacher Mobile App.
     * Enforces Version Conflict rules and Option A VOIDED rule on cancellation.
     */
    @Transactional
    public PwaSyncPushResponse processPwaPush(PwaSyncPushRequest req) {
        String instId = req.getInstitutionId() != null ? req.getInstitutionId() : "inst-001";
        ensureTenant(instId);

        PwaSyncPushRequest.SessionDto sDto = req.getSession();
        int conflictsCount = 0;
        int recordsProcessed = 0;

        if (sDto != null) {
            Optional<CloudAttendanceSession> existingOpt =
                    sessionRepo.findByInstitutionIdAndSessionId(instId, sDto.getSessionId());

            Long incomingVer = sDto.getVersion() != null ? sDto.getVersion() : 1L;

            if (existingOpt.isPresent()) {
                CloudAttendanceSession existing = existingOpt.get();
                if (incomingVer <= existing.getVersion()) {
                    // Check if identical content (idempotent retry) or divergent
                    if (!Objects.equals(sDto.getStatus(), existing.getStatus()) ||
                        !Objects.equals(sDto.getTopicId(), existing.getTopicId())) {
                        // Divergent version conflict!
                        conflictsCount++;
                        logConflict(instId, "ATTENDANCE_SESSION", sDto.getSessionId(), incomingVer,
                                existing.getVersion(), sDto, existing);
                    }
                    // Retain stored version
                } else {
                    // Incoming is newer
                    existing.setStatus(sDto.getStatus());
                    existing.setEndTime(sDto.getEndTime());
                    existing.setTopicId(sDto.getTopicId());
                    existing.setCustomTopic(sDto.getCustomTopic());
                    existing.setVersion(incomingVer);
                    existing.setUpdatedAt(Instant.now());
                    sessionRepo.save(existing);
                }
            } else {
                CloudAttendanceSession newSession = CloudAttendanceSession.builder()
                        .id(UUID.randomUUID().toString())
                        .sessionId(sDto.getSessionId())
                        .institutionId(instId)
                        .facultyId(sDto.getFacultyId())
                        .subjectId(sDto.getSubjectId())
                        .batchId(sDto.getBatchId())
                        .academicYearId(sDto.getAcademicYearId())
                        .studentGroupId(sDto.getStudentGroupId())
                        .sessionDate(sDto.getSessionDate())
                        .startTime(sDto.getStartTime())
                        .endTime(sDto.getEndTime())
                        .status(sDto.getStatus() != null ? sDto.getStatus() : "COMPLETED")
                        .topicId(sDto.getTopicId())
                        .customTopic(sDto.getCustomTopic())
                        .sourceDevice("TEACHER_PWA")
                        .version(incomingVer)
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build();
                sessionRepo.save(newSession);
            }
        }

        // Process individual attendance records
        boolean isSessionCancelled = sDto != null && "CANCELLED".equalsIgnoreCase(sDto.getStatus());

        if (req.getRecords() != null && sDto != null) {
            for (PwaSyncPushRequest.RecordDto rDto : req.getRecords()) {
                Optional<CloudAttendanceRecord> existingRecOpt =
                        recordRepo.findByInstitutionIdAndSessionIdAndStudentId(instId, sDto.getSessionId(), rDto.getStudentId());

                Long recVer = rDto.getVersion() != null ? rDto.getVersion() : 1L;
                String effectiveRecordState = isSessionCancelled ? "VOIDED" : (rDto.getRecordState() != null ? rDto.getRecordState() : "ACTIVE");

                if (existingRecOpt.isPresent()) {
                    CloudAttendanceRecord existingRec = existingRecOpt.get();
                    if (recVer > existingRec.getVersion()) {
                        existingRec.setStatus(rDto.getStatus());
                        existingRec.setRecognitionMethod(rDto.getRecognitionMethod());
                        existingRec.setRecordState(effectiveRecordState);
                        existingRec.setVersion(recVer);
                        existingRec.setUpdatedAt(Instant.now());
                        recordRepo.save(existingRec);
                    }
                } else {
                    CloudAttendanceRecord newRec = CloudAttendanceRecord.builder()
                            .id(UUID.randomUUID().toString())
                            .recordId(rDto.getRecordId() != null ? rDto.getRecordId() : UUID.randomUUID().toString())
                            .sessionId(sDto.getSessionId())
                            .institutionId(instId)
                            .studentId(rDto.getStudentId())
                            .status(rDto.getStatus() != null ? rDto.getStatus() : "ABSENT")
                            .recognitionMethod(rDto.getRecognitionMethod() != null ? rDto.getRecognitionMethod() : "MANUAL_TEACHER")
                            .recordState(effectiveRecordState)
                            .confidenceScore(rDto.getConfidenceScore())
                            .markedAt(rDto.getMarkedAt() != null ? rDto.getMarkedAt() : Instant.now())
                            .version(recVer)
                            .createdAt(Instant.now())
                            .updatedAt(Instant.now())
                            .build();
                    recordRepo.save(newRec);
                }
                recordsProcessed++;
            }
        }

        // Emit cloud outbox event so Desktop clients can pick up changes
        try {
            outboxRepo.save(CloudOutboxEvent.builder()
                    .institutionId(instId)
                    .eventType("SESSION_SYNCED")
                    .entityId(sDto != null ? sDto.getSessionId() : "batch")
                    .payload(objectMapper.writeValueAsString(req))
                    .createdAt(Instant.now())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to serialize cloud outbox payload", e);
        }

        return PwaSyncPushResponse.builder()
                .success(true)
                .sessionId(sDto != null ? sDto.getSessionId() : null)
                .recordsProcessed(recordsProcessed)
                .conflictsEncountered(conflictsCount)
                .message("Sync successful. Processed " + recordsProcessed + " records.")
                .build();
    }

    /**
     * PWA Pull: Returns assigned classes, topics, and student roster for the teacher.
     */
    @Transactional(readOnly = true)
    public PwaSyncPullResponse getPwaPullData(String institutionId, String facultyId) {
        ensureTenant(institutionId);

        List<CloudClassAssignment> classes = (facultyId != null && !facultyId.isBlank())
                ? classRepo.findByInstitutionIdAndFacultyId(institutionId, facultyId)
                : classRepo.findByInstitutionId(institutionId);

        List<CloudTopic> topics = topicRepo.findByInstitutionId(institutionId);
        List<CloudStudentRoster> students = studentRepo.findByInstitutionId(institutionId);
        List<CloudTeacher> teachers = teacherRepo.findByInstitutionId(institutionId);

        // Fallback: If requested institutionId has no classes/students, fall back to any active institution with data
        if (classes.isEmpty() && students.isEmpty()) {
            List<CloudStudentRoster> allStudents = studentRepo.findAll();
            if (!allStudents.isEmpty()) {
                String fallbackInstId = allStudents.get(0).getInstitutionId();
                classes = classRepo.findByInstitutionId(fallbackInstId);
                topics = topicRepo.findByInstitutionId(fallbackInstId);
                teachers = teacherRepo.findByInstitutionId(fallbackInstId);
                students = allStudents;
                institutionId = fallbackInstId;
            }
        }

        return PwaSyncPullResponse.builder()
                .institutionId(institutionId)
                .classes(classes)
                .topics(topics)
                .students(students)
                .teachers(teachers)
                .build();
    }

    /**
     * Desktop Push: Desktop app pushes master classes, syllabus topics, students, and teachers.
     */
    @Transactional
    public DesktopSyncPushResponse processDesktopPush(DesktopSyncPushRequest req) {
        String instId = req.getInstitutionId() != null ? req.getInstitutionId() : "inst-001";
        ensureTenant(instId);

        int topicsCount = 0;
        int studentsCount = 0;
        int classesCount = 0;

        if (req.getTopics() != null) {
            for (CloudTopic t : req.getTopics()) {
                t.setInstitutionId(instId);
                topicRepo.save(t);
                topicsCount++;
            }
        }

        if (req.getStudents() != null) {
            for (CloudStudentRoster s : req.getStudents()) {
                s.setInstitutionId(instId);
                studentRepo.save(s);
                studentsCount++;
            }
        }

        if (req.getClasses() != null) {
            for (CloudClassAssignment c : req.getClasses()) {
                c.setInstitutionId(instId);
                classRepo.save(c);
                classesCount++;
            }
        }

        if (req.getTeachers() != null) {
            for (CloudTeacher th : req.getTeachers()) {
                th.setInstitutionId(instId);
                teacherRepo.save(th);
            }
        }

        return DesktopSyncPushResponse.builder()
                .success(true)
                .topicsCount(topicsCount)
                .studentsCount(studentsCount)
                .classesCount(classesCount)
                .message("Desktop sync push complete.")
                .build();
    }

    public Optional<CloudTeacher> authenticateTeacher(String identifier) {
        if (identifier == null || identifier.isBlank()) return Optional.empty();
        String clean = identifier.trim();
        Optional<CloudTeacher> byUsername = teacherRepo.findByUsername(clean);
        if (byUsername.isPresent()) return byUsername;
        Optional<CloudTeacher> byEmp = teacherRepo.findByEmployeeId(clean);
        if (byEmp.isPresent()) return byEmp;
        return teacherRepo.findAll().stream()
                .filter(t -> t.getName() != null && t.getName().equalsIgnoreCase(clean))
                .findFirst();
    }

    /**
     * Desktop Pull: Desktop app pulls completed sessions from cloud to local SQLite.
     */
    @Transactional(readOnly = true)
    public DesktopSyncPullResponse getDesktopPullData(String institutionId) {
        return getDesktopPullData(institutionId, null, null);
    }

    @Transactional(readOnly = true)
    public DesktopSyncPullResponse getDesktopPullData(String institutionId, String sessionDateStr, String sinceStr) {
        ensureTenant(institutionId);

        List<CloudAttendanceSession> sessions;
        if (sessionDateStr != null && !sessionDateStr.isBlank()) {
            try {
                java.time.LocalDate date = java.time.LocalDate.parse(sessionDateStr);
                sessions = sessionRepo.findByInstitutionIdAndSessionDate(institutionId, date);
            } catch (Exception e) {
                log.warn("Invalid sessionDate filter: {}", sessionDateStr);
                sessions = sessionRepo.findByInstitutionId(institutionId);
            }
        } else if (sinceStr != null && !sinceStr.isBlank()) {
            try {
                Instant since = Instant.parse(sinceStr);
                sessions = sessionRepo.findByInstitutionIdAndUpdatedAtAfter(institutionId, since);
            } catch (Exception e) {
                log.warn("Invalid since filter: {}", sinceStr);
                sessions = sessionRepo.findByInstitutionId(institutionId);
            }
        } else {
            sessions = sessionRepo.findByInstitutionId(institutionId);
        }

        List<CloudAttendanceRecord> allRecords = new ArrayList<>();
        for (CloudAttendanceSession s : sessions) {
            allRecords.addAll(recordRepo.findByInstitutionIdAndSessionId(institutionId, s.getSessionId()));
        }

        List<CloudSyncConflict> conflicts = conflictRepo.findByInstitutionIdAndResolvedFalse(institutionId);

        return DesktopSyncPullResponse.builder()
                .institutionId(institutionId)
                .sessions(sessions)
                .records(allRecords)
                .conflicts(conflicts)
                .build();
    }

    private void logConflict(String instId, String entityType, String entityId,
                             Long incomingVer, Long storedVer, Object incomingObj, Object storedObj) {
        try {
            conflictRepo.save(CloudSyncConflict.builder()
                    .id(UUID.randomUUID().toString())
                    .institutionId(instId)
                    .entityType(entityType)
                    .entityId(entityId)
                    .incomingVersion(incomingVer)
                    .storedVersion(storedVer)
                    .incomingPayload(objectMapper.writeValueAsString(incomingObj))
                    .storedPayload(objectMapper.writeValueAsString(storedObj))
                    .resolutionStrategy("LOG_AND_STORED_WINS")
                    .resolved(false)
                    .createdAt(Instant.now())
                    .build());
        } catch (Exception e) {
            log.error("Failed to log sync conflict", e);
        }
    }
}
