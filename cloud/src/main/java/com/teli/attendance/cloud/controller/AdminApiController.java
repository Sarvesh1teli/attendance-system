package com.teli.attendance.cloud.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.teli.attendance.cloud.domain.entity.*;
import com.teli.attendance.cloud.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminApiController {

    private final CloudStudentRosterRepository studentRepo;
    private final CloudClassAssignmentRepository classRepo;
    private final CloudTopicRepository topicRepo;
    private final CloudTeacherRepository teacherRepo;
    private final CloudAttendanceSessionRepository sessionRepo;
    private final CloudAttendanceRecordRepository recordRepo;
    private final TenantInstitutionRepository tenantRepo;
    private final CloudTenantEntityRepository tenantEntityRepo;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String resolveId(String institutionId) {
        if (institutionId == null || institutionId.isBlank()) {
            return "";
        }
        String clean = institutionId.trim();
        // Check if there are already records under this ID
        if (!studentRepo.findByInstitutionId(clean).isEmpty() || !teacherRepo.findByInstitutionId(clean).isEmpty()) {
            return clean;
        }
        // Resolve code via teacher institution name
        for (CloudTeacher t : teacherRepo.findAll()) {
            if (clean.equalsIgnoreCase(t.getInstitutionName()) && t.getInstitutionId() != null) {
                return t.getInstitutionId();
            }
        }
        return clean;
    }

    // ─── Multi-Tenant Academic Entities (Batches, Programs, Departments, Years, Subjects, Groups) ───

    @GetMapping("/entities/{entityType}")
    public ResponseEntity<List<Map<String, Object>>> getEntities(
            @PathVariable String entityType,
            @RequestParam(required = false, defaultValue = "") String institutionId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<CloudTenantEntity> list = tenantEntityRepo.findByInstitutionIdAndEntityType(resId, entityType.toLowerCase().trim());
        List<Map<String, Object>> result = new ArrayList<>();
        for (CloudTenantEntity e : list) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = objectMapper.readValue(e.getDataJson(), Map.class);
                map.put("id", e.getId());
                map.put("institution_id", resId);
                result.add(map);
            } catch (Exception ex) {
                log.error("Failed to parse entity json for id {}", e.getId(), ex);
            }
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/entities/{entityType}")
    public ResponseEntity<Map<String, Object>> createEntity(
            @PathVariable String entityType,
            @RequestParam String institutionId,
            @RequestBody Map<String, Object> payload) {
        String resId = resolveId(institutionId);
        String type = entityType.toLowerCase().trim();

        // Extract or generate ID strictly for this entity type
        String id = null;
        if ("batches".equals(type) && payload.get("batch_id") != null) id = String.valueOf(payload.get("batch_id"));
        else if ("programs".equals(type) && payload.get("program_id") != null) id = String.valueOf(payload.get("program_id"));
        else if ("departments".equals(type) && payload.get("department_id") != null) id = String.valueOf(payload.get("department_id"));
        else if ("academicyears".equals(type) && payload.get("academic_year_id") != null) id = String.valueOf(payload.get("academic_year_id"));
        else if ("subjects".equals(type) && payload.get("subject_id") != null) id = String.valueOf(payload.get("subject_id"));
        else if ("groups".equals(type) && payload.get("student_group_id") != null) id = String.valueOf(payload.get("student_group_id"));
        else if (payload.get("id") != null) id = String.valueOf(payload.get("id"));

        if (id == null || id.isBlank()) {
            id = type + "-" + UUID.randomUUID().toString().substring(0, 8);
        }

        // Map canonical ID fields back so frontend models recognize them
        if ("batches".equals(type) && !payload.containsKey("batch_id")) payload.put("batch_id", id);
        if ("programs".equals(type) && !payload.containsKey("program_id")) payload.put("program_id", id);
        if ("departments".equals(type) && !payload.containsKey("department_id")) payload.put("department_id", id);
        if ("academicyears".equals(type) && !payload.containsKey("academic_year_id")) payload.put("academic_year_id", id);
        if ("subjects".equals(type) && !payload.containsKey("subject_id")) payload.put("subject_id", id);
        if ("groups".equals(type) && !payload.containsKey("student_group_id")) payload.put("student_group_id", id);

        payload.put("id", id);
        payload.put("institution_id", resId);
        if (!payload.containsKey("created_at")) payload.put("created_at", Instant.now().toString());
        payload.put("updated_at", Instant.now().toString());

        try {
            String json = objectMapper.writeValueAsString(payload);
            CloudTenantEntity entity = CloudTenantEntity.builder()
                    .id(id)
                    .institutionId(resId)
                    .entityType(type)
                    .dataJson(json)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            tenantEntityRepo.save(entity);
            return ResponseEntity.ok(payload);
        } catch (Exception ex) {
            log.error("Failed to save entity {}", type, ex);
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/entities/{entityType}/{id}")
    public ResponseEntity<Map<String, Object>> updateEntity(
            @PathVariable String entityType,
            @PathVariable String id,
            @RequestParam String institutionId,
            @RequestBody Map<String, Object> payload) {
        String resId = resolveId(institutionId);
        String type = entityType.toLowerCase().trim();

        payload.put("id", id);
        payload.put("institution_id", resId);
        payload.put("updated_at", Instant.now().toString());

        try {
            String json = objectMapper.writeValueAsString(payload);
            Optional<CloudTenantEntity> opt = tenantEntityRepo.findByInstitutionIdAndEntityTypeAndId(resId, type, id);
            CloudTenantEntity entity = opt.orElseGet(() -> CloudTenantEntity.builder()
                    .id(id)
                    .institutionId(resId)
                    .entityType(type)
                    .createdAt(Instant.now())
                    .build());
            entity.setDataJson(json);
            entity.setUpdatedAt(Instant.now());
            tenantEntityRepo.save(entity);
            return ResponseEntity.ok(payload);
        } catch (Exception ex) {
            log.error("Failed to update entity {}", type, ex);
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @Transactional
    @DeleteMapping("/entities/{entityType}/{id}")
    public ResponseEntity<Map<String, Object>> deleteEntity(
            @PathVariable String entityType,
            @PathVariable String id,
            @RequestParam String institutionId) {
        String resId = resolveId(institutionId);
        String type = entityType.toLowerCase().trim();
        tenantEntityRepo.deleteByInstitutionIdAndEntityTypeAndId(resId, type, id);
        return ResponseEntity.ok(Map.of("success", true, "deleted", id));
    }

    // ─── Institution Details ───

    @GetMapping("/institution")
    public ResponseEntity<Map<String, Object>> getInstitution(@RequestParam(required = false, defaultValue = "") String institutionId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Institution ID is required"));
        }
        Optional<TenantInstitution> opt = tenantRepo.findById(resId);
        if (opt.isEmpty()) {
            opt = tenantRepo.findAll().stream()
                    .filter(t -> resId.equalsIgnoreCase(t.getName()) || resId.equalsIgnoreCase(t.getId()))
                    .findFirst();
        }

        if (opt.isPresent()) {
            TenantInstitution t = opt.get();
            return ResponseEntity.ok(Map.of(
                    "id", t.getId(),
                    "name", t.getName(),
                    "phone", t.getPhone() != null ? t.getPhone() : "+91 80 2345 6789",
                    "email", t.getEmail() != null ? t.getEmail() : t.getId() + "@telicampus.in",
                    "adminName", t.getAdminName() != null ? t.getAdminName() : "Administrator",
                    "adminEmail", t.getAdminEmail() != null ? t.getAdminEmail() : "admin@" + t.getId() + ".telicampus.in",
                    "plan", t.getPlan() != null ? t.getPlan() : "ANNUAL_ENTERPRISE",
                    "status", t.getStatus() != null ? t.getStatus() : "ACTIVE"
            ));
        }

        return ResponseEntity.ok(Map.of(
                "id", resId,
                "name", resId.toUpperCase() + " Campus",
                "phone", "+91 80 2345 6789",
                "email", resId + "@telicampus.in",
                "adminName", "Administrator",
                "adminEmail", "admin@" + resId + ".telicampus.in",
                "plan", "ANNUAL_ENTERPRISE",
                "status", "ACTIVE"
        ));
    }

    @PutMapping("/institution")
    public ResponseEntity<Map<String, Object>> updateInstitution(
            @RequestParam String institutionId,
            @RequestBody Map<String, Object> body) {
        String resId = resolveId(institutionId);
        Optional<TenantInstitution> opt = tenantRepo.findById(resId);
        TenantInstitution t = opt.orElseGet(() -> TenantInstitution.builder().id(resId).status("ACTIVE").build());

        if (body.get("name") != null) t.setName(String.valueOf(body.get("name")));
        if (body.get("phone") != null) t.setPhone(String.valueOf(body.get("phone")));
        if (body.get("email") != null) t.setEmail(String.valueOf(body.get("email")));
        if (body.get("adminName") != null) t.setAdminName(String.valueOf(body.get("adminName")));
        if (body.get("adminEmail") != null) t.setAdminEmail(String.valueOf(body.get("adminEmail")));

        tenantRepo.save(t);
        return ResponseEntity.ok(Map.of("success", true, "message", "Institution updated"));
    }

    // ─── Student CRUD ───

    @GetMapping("/students")
    public ResponseEntity<List<CloudStudentRoster>> getStudents(
            @RequestParam(required = false, defaultValue = "") String institutionId,
            @RequestParam(required = false) String batchId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<CloudStudentRoster> list = (batchId != null && !batchId.isBlank())
                ? studentRepo.findByInstitutionIdAndBatchId(resId, batchId)
                : studentRepo.findByInstitutionId(resId);
        return ResponseEntity.ok(list);
    }

    @PostMapping("/students")
    public ResponseEntity<CloudStudentRoster> createStudent(
            @RequestParam String institutionId,
            @RequestBody CloudStudentRoster student) {
        String resId = resolveId(institutionId);
        if (student.getId() == null || student.getId().isBlank()) {
            student.setId(UUID.randomUUID().toString());
        }
        student.setInstitutionId(resId);
        student.setCreatedAt(Instant.now());
        student.setUpdatedAt(Instant.now());
        CloudStudentRoster saved = studentRepo.save(student);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/students/{id}")
    public ResponseEntity<Map<String, Object>> deleteStudent(
            @PathVariable String id,
            @RequestParam String institutionId) {
        studentRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "deleted", id));
    }

    // ─── Faculty / Teacher CRUD ───

    @GetMapping("/teachers")
    public ResponseEntity<List<CloudTeacher>> getTeachers(
            @RequestParam(required = false, defaultValue = "") String institutionId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        return ResponseEntity.ok(teacherRepo.findByInstitutionId(resId));
    }

    @PostMapping("/teachers")
    public ResponseEntity<CloudTeacher> createTeacher(
            @RequestParam String institutionId,
            @RequestBody CloudTeacher teacher) {
        String resId = resolveId(institutionId);
        if (teacher.getId() == null || teacher.getId().isBlank()) {
            teacher.setId(UUID.randomUUID().toString());
        }
        teacher.setInstitutionId(resId);
        teacher.setUpdatedAt(Instant.now());
        CloudTeacher saved = teacherRepo.save(teacher);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/teachers/{id}")
    public ResponseEntity<Map<String, Object>> deleteTeacher(
            @PathVariable String id,
            @RequestParam String institutionId) {
        teacherRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "deleted", id));
    }

    // ─── Classes, Topics, Sessions, Reports ───

    @GetMapping("/classes")
    public ResponseEntity<List<CloudClassAssignment>> getClasses(
            @RequestParam(required = false, defaultValue = "") String institutionId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        return ResponseEntity.ok(classRepo.findByInstitutionId(resId));
    }

    @GetMapping("/topics")
    public ResponseEntity<List<CloudTopic>> getTopics(
            @RequestParam(required = false, defaultValue = "") String institutionId,
            @RequestParam(required = false) String subjectId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<CloudTopic> list = (subjectId != null && !subjectId.isBlank())
                ? topicRepo.findByInstitutionIdAndSubjectId(resId, subjectId)
                : topicRepo.findByInstitutionId(resId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<CloudAttendanceSession>> getSessions(
            @RequestParam(required = false, defaultValue = "") String institutionId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        return ResponseEntity.ok(sessionRepo.findByInstitutionId(resId));
    }

    @GetMapping("/reports/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam(required = false, defaultValue = "") String institutionId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "totalStudents", 0,
                    "totalTeachers", 0,
                    "totalClasses", 0,
                    "totalSessions", 0
            ));
        }
        long studentCount = studentRepo.findByInstitutionId(resId).size();
        long teacherCount = teacherRepo.findByInstitutionId(resId).size();
        long classCount = classRepo.findByInstitutionId(resId).size();
        long sessionCount = sessionRepo.findByInstitutionId(resId).size();

        return ResponseEntity.ok(Map.of(
                "totalStudents", studentCount,
                "totalTeachers", teacherCount,
                "totalClasses", classCount,
                "totalSessions", sessionCount
        ));
    }

}
