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
        String type = entityType.toLowerCase().trim();
        for (CloudTenantEntity e : list) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = objectMapper.readValue(e.getDataJson(), Map.class);
                map.put("id", e.getId());
                map.put("institution_id", resId);
                if ("batches".equals(type) && !map.containsKey("batch_id")) map.put("batch_id", e.getId());
                if ("programs".equals(type) && !map.containsKey("program_id")) map.put("program_id", e.getId());
                if ("departments".equals(type) && !map.containsKey("department_id")) map.put("department_id", e.getId());
                if ("academicyears".equals(type) && !map.containsKey("academic_year_id")) map.put("academic_year_id", e.getId());
                if ("subjects".equals(type) && !map.containsKey("subject_id")) map.put("subject_id", e.getId());
                if ("groups".equals(type) && !map.containsKey("student_group_id")) map.put("student_group_id", e.getId());
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
        if (!payload.containsKey("active")) {
            payload.put("active", true);
        }
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

        String targetId = id;
        if (targetId == null || targetId.isBlank() || "undefined".equalsIgnoreCase(targetId)) {
            if (payload.get("batch_id") != null) targetId = String.valueOf(payload.get("batch_id"));
            else if (payload.get("program_id") != null) targetId = String.valueOf(payload.get("program_id"));
            else if (payload.get("department_id") != null) targetId = String.valueOf(payload.get("department_id"));
            else if (payload.get("subject_id") != null) targetId = String.valueOf(payload.get("subject_id"));
            else if (payload.get("academic_year_id") != null) targetId = String.valueOf(payload.get("academic_year_id"));
            else if (payload.get("id") != null) targetId = String.valueOf(payload.get("id"));
        }
        final String finalId = targetId;

        try {
            Optional<CloudTenantEntity> opt = tenantEntityRepo.findByInstitutionIdAndEntityTypeAndId(resId, type, finalId);
            Map<String, Object> merged = new HashMap<>();
            if (opt.isPresent() && opt.get().getDataJson() != null) {
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> existing = objectMapper.readValue(opt.get().getDataJson(), Map.class);
                    if (existing != null) merged.putAll(existing);
                } catch (Exception ignored) {}
            }
            merged.putAll(payload);
            merged.put("id", finalId);
            merged.put("institution_id", resId);
            merged.put("updated_at", Instant.now().toString());

            String json = objectMapper.writeValueAsString(merged);
            CloudTenantEntity entity = opt.orElseGet(() -> CloudTenantEntity.builder()
                    .id(finalId)
                    .institutionId(resId)
                    .entityType(type)
                    .createdAt(Instant.now())
                    .build());
            entity.setDataJson(json);
            entity.setUpdatedAt(Instant.now());
            tenantEntityRepo.save(entity);
            return ResponseEntity.ok(merged);
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
        if (student.getStudentId() == null || student.getStudentId().isBlank()) {
            student.setStudentId(student.getId());
        }
        if (student.getAdmissionNumber() == null || student.getAdmissionNumber().isBlank()) {
            student.setAdmissionNumber(student.getId().substring(0, 8));
        }
        if (student.getBatchId() == null) {
            student.setBatchId("");
        }
        if (student.getName() == null || student.getName().isBlank()) {
            student.setName("Student");
        }
        if (student.getFaceEnrolled() == null) {
            student.setFaceEnrolled(false);
        }
        if (student.getVersion() == null) {
            student.setVersion(1L);
        }
        student.setInstitutionId(resId);
        student.setCreatedAt(Instant.now());
        student.setUpdatedAt(Instant.now());
        CloudStudentRoster saved = studentRepo.save(student);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/students/{id}")
    public ResponseEntity<CloudStudentRoster> updateStudent(
            @PathVariable String id,
            @RequestParam String institutionId,
            @RequestBody CloudStudentRoster student) {
        String resId = resolveId(institutionId);
        Optional<CloudStudentRoster> opt = studentRepo.findById(id);
        if (opt.isEmpty()) {
            opt = studentRepo.findByInstitutionIdAndStudentId(resId, id);
        }
        if (opt.isEmpty() && student.getStudentId() != null) {
            opt = studentRepo.findByInstitutionIdAndStudentId(resId, student.getStudentId());
        }
        if (opt.isPresent()) {
            CloudStudentRoster existing = opt.get();
            if (student.getName() != null && !student.getName().isBlank()) existing.setName(student.getName().trim());
            if (student.getGender() != null) existing.setGender(student.getGender());
            if (student.getBatchId() != null && !student.getBatchId().isBlank()) existing.setBatchId(student.getBatchId());
            if (student.getAdmissionNumber() != null && !student.getAdmissionNumber().isBlank()) existing.setAdmissionNumber(student.getAdmissionNumber().trim());
            if (student.getFaceEnrolled() != null) existing.setFaceEnrolled(student.getFaceEnrolled());
            if (student.getFaceDescriptor() != null) existing.setFaceDescriptor(student.getFaceDescriptor());
            existing.setUpdatedAt(Instant.now());
            return ResponseEntity.ok(studentRepo.save(existing));
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/students/{id}/face-enroll")
    public ResponseEntity<Map<String, Object>> enrollStudentFace(
            @PathVariable String id,
            @RequestParam String institutionId,
            @RequestBody(required = false) Map<String, Object> body) {
        String resId = resolveId(institutionId);
        Optional<CloudStudentRoster> opt = studentRepo.findById(id);
        if (opt.isEmpty()) {
            opt = studentRepo.findByInstitutionIdAndStudentId(resId, id);
        }
        if (opt.isEmpty()) {
            opt = studentRepo.findByInstitutionId(resId).stream()
                    .filter(s -> id.equalsIgnoreCase(s.getId()) || id.equalsIgnoreCase(s.getStudentId()))
                    .findFirst();
        }
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("success", false, "error", "Student not found: " + id));
        }

        CloudStudentRoster s = opt.get();
        s.setFaceEnrolled(true);
        if (body != null && body.containsKey("faceDescriptor")) {
            Object desc = body.get("faceDescriptor");
            if (desc instanceof String str) {
                s.setFaceDescriptor(str);
            } else if (desc != null) {
                try {
                    s.setFaceDescriptor(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(desc));
                } catch (Exception e) {
                    s.setFaceDescriptor(desc.toString());
                }
            }
        }
        s.setUpdatedAt(Instant.now());
        studentRepo.save(s);
        log.info("[FaceEnrollment] Successfully enrolled face for student '{}' ({})", s.getName(), s.getStudentId());
        return ResponseEntity.ok(Map.of(
                "success", true,
                "student_id", s.getStudentId(),
                "name", s.getName(),
                "face_enrolled", true
        ));
    }

    @DeleteMapping("/students/{id}/face-enroll")
    public ResponseEntity<Map<String, Object>> revokeStudentFace(
            @PathVariable String id,
            @RequestParam String institutionId) {
        String resId = resolveId(institutionId);
        Optional<CloudStudentRoster> opt = studentRepo.findById(id);
        if (opt.isEmpty()) {
            opt = studentRepo.findByInstitutionIdAndStudentId(resId, id);
        }
        if (opt.isEmpty()) {
            opt = studentRepo.findByInstitutionId(resId).stream()
                    .filter(s -> id.equalsIgnoreCase(s.getId()) || id.equalsIgnoreCase(s.getStudentId()))
                    .findFirst();
        }
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("success", false, "error", "Student not found: " + id));
        }

        CloudStudentRoster s = opt.get();
        s.setFaceEnrolled(false);
        s.setFaceDescriptor(null);
        s.setUpdatedAt(Instant.now());
        studentRepo.save(s);
        log.info("[FaceEnrollment] Revoked face enrollment for student '{}' ({})", s.getName(), s.getStudentId());
        return ResponseEntity.ok(Map.of(
                "success", true,
                "student_id", s.getStudentId(),
                "name", s.getName(),
                "face_enrolled", false
        ));
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

    @GetMapping("/teacher-accounts")
    public List<Map<String, Object>> teacherAccounts(@RequestParam String institutionId) {
        return teacherRepo.findByInstitutionId(resolveId(institutionId)).stream()
                .filter(t -> t.getUsername() != null && !t.getUsername().isBlank())
                .map(this::teacherAccount).toList();
    }

    private Map<String, Object> teacherAccount(CloudTeacher t) {
        return Map.of("user_id", t.getId(), "faculty_id", t.getId(),
                "username", t.getUsername(), "role", "FACULTY", "status", "ACTIVE");
    }

    @PutMapping("/teacher-accounts/{id}")
    @Transactional
    public ResponseEntity<?> saveTeacherAccount(@PathVariable String id,
            @RequestParam String institutionId, @RequestBody Map<String, String> input) {
        String tenant = resolveId(institutionId);
        CloudTeacher teacher = teacherRepo.findById(id).orElse(null);
        if (teacher == null || !tenant.equals(teacher.getInstitutionId()))
            return ResponseEntity.status(404).body(Map.of("error", "Teacher not found"));
        String username = input.getOrDefault("username", "").trim();
        String password = input.getOrDefault("password", "");
        if (username.isBlank() || username.length() > 64)
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required (maximum 64 characters)"));
        if (teacherRepo.findByInstitutionId(tenant).stream().anyMatch(t -> !id.equals(t.getId())
                && username.equalsIgnoreCase(t.getUsername())))
            return ResponseEntity.status(409).body(Map.of("error", "Username already exists in this institution"));
        if (password.isEmpty() && (teacher.getPasswordHash() == null || !teacher.getPasswordHash().startsWith("pbkdf2$")))
            return ResponseEntity.badRequest().body(Map.of("error", "Set a password to enable this teacher login"));
        teacher.setUsername(username);
        if (!password.isEmpty()) teacher.setPasswordHash(
                com.teli.attendance.cloud.service.TeacherPasswords.hash(password));
        teacher.setUpdatedAt(Instant.now());
        teacherRepo.save(teacher);
        return ResponseEntity.ok(teacherAccount(teacher));
    }

    @PutMapping("/teachers/{id}/face-enroll")
    public ResponseEntity<Map<String, Object>> enrollTeacherFace(
            @PathVariable String id,
            @RequestParam String institutionId,
            @RequestBody(required = false) Map<String, Object> body) {
        String resId = resolveId(institutionId);
        Optional<CloudTeacher> opt = teacherRepo.findById(id);
        if (opt.isEmpty()) {
            opt = teacherRepo.findByInstitutionId(resId).stream()
                    .filter(t -> id.equalsIgnoreCase(t.getId()) || id.equalsIgnoreCase(t.getEmployeeId()))
                    .findFirst();
        }
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("success", false, "error", "Teacher not found: " + id));
        }
        CloudTeacher t = opt.get();
        if (body != null && body.containsKey("faceDescriptor")) {
            Object desc = body.get("faceDescriptor");
            if (desc instanceof String str) {
                t.setFaceDescriptor(str);
            } else if (desc != null) {
                try {
                    t.setFaceDescriptor(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(desc));
                } catch (Exception e) {
                    t.setFaceDescriptor(desc.toString());
                }
            }
        }
        t.setUpdatedAt(Instant.now());
        teacherRepo.save(t);
        log.info("[FaceEnrollment] Successfully enrolled face for teacher '{}' ({})", t.getName(), t.getId());
        return ResponseEntity.ok(Map.of("success", true, "teacher_id", t.getId(), "name", t.getName(), "face_enrolled", true));
    }

    @DeleteMapping("/teachers/{id}/face-enroll")
    public ResponseEntity<Map<String, Object>> revokeTeacherFace(
            @PathVariable String id,
            @RequestParam String institutionId) {
        String resId = resolveId(institutionId);
        Optional<CloudTeacher> opt = teacherRepo.findById(id);
        if (opt.isEmpty()) {
            opt = teacherRepo.findByInstitutionId(resId).stream()
                    .filter(t -> id.equalsIgnoreCase(t.getId()) || id.equalsIgnoreCase(t.getEmployeeId()))
                    .findFirst();
        }
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("success", false, "error", "Teacher not found: " + id));
        }
        CloudTeacher t = opt.get();
        t.setFaceDescriptor(null);
        t.setUpdatedAt(Instant.now());
        teacherRepo.save(t);
        log.info("[FaceEnrollment] Revoked face enrollment for teacher '{}' ({})", t.getName(), t.getId());
        return ResponseEntity.ok(Map.of("success", true, "teacher_id", t.getId(), "name", t.getName(), "face_enrolled", false));
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

    // ─── Timetable Management (Multi-Tenant & Sync to CloudClassAssignment) ───

    private Map<String, Object> enrichTimetableSlot(String resId, Map<String, Object> payload) {
        String facultyId = payload.get("faculty_id") != null ? String.valueOf(payload.get("faculty_id")) : "";
        if ((payload.get("faculty_name") == null || String.valueOf(payload.get("faculty_name")).isBlank()) && !facultyId.isBlank()) {
            Optional<CloudTeacher> tOpt = teacherRepo.findById(facultyId);
            tOpt.ifPresent(t -> payload.put("faculty_name", t.getName()));
        }

        String subjectId = payload.get("subject_id") != null ? String.valueOf(payload.get("subject_id")) : "";
        if (!subjectId.isBlank() && (payload.get("subject_name") == null || payload.get("subject_code") == null)) {
            Optional<CloudTenantEntity> sOpt = tenantEntityRepo.findByInstitutionIdAndEntityTypeAndId(resId, "subjects", subjectId);
            if (sOpt.isPresent()) {
                try {
                    Map<?, ?> sMap = objectMapper.readValue(sOpt.get().getDataJson(), Map.class);
                    if (payload.get("subject_name") == null && sMap.get("subject_name") != null) {
                        payload.put("subject_name", sMap.get("subject_name"));
                    }
                    if (payload.get("subject_code") == null && sMap.get("subject_code") != null) {
                        payload.put("subject_code", sMap.get("subject_code"));
                    }
                } catch (Exception ignored) {}
            }
        }

        String batchId = payload.get("batch_id") != null ? String.valueOf(payload.get("batch_id")) : "";
        if (!batchId.isBlank() && payload.get("batch_name") == null) {
            Optional<CloudTenantEntity> bOpt = tenantEntityRepo.findByInstitutionIdAndEntityTypeAndId(resId, "batches", batchId);
            if (bOpt.isPresent()) {
                try {
                    Map<?, ?> bMap = objectMapper.readValue(bOpt.get().getDataJson(), Map.class);
                    if (bMap.get("batch_name") != null) {
                        payload.put("batch_name", bMap.get("batch_name"));
                    }
                } catch (Exception ignored) {}
            }
        }

        if (!payload.containsKey("active") || payload.get("active") == null) {
            payload.put("active", true);
        }

        return payload;
    }

    @GetMapping("/timetable")
    public ResponseEntity<List<Map<String, Object>>> getTimetable(
            @RequestParam(required = false, defaultValue = "") String institutionId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<CloudTenantEntity> list = tenantEntityRepo.findByInstitutionIdAndEntityType(resId, "timetables");
        List<Map<String, Object>> result = new ArrayList<>();
        for (CloudTenantEntity e : list) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = objectMapper.readValue(e.getDataJson(), Map.class);
                map.put("slot_id", e.getId());
                map.put("id", e.getId());
                map.put("institution_id", resId);
                enrichTimetableSlot(resId, map);
                result.add(map);
            } catch (Exception ex) {
                log.error("Failed to parse timetable slot json for id {}", e.getId(), ex);
            }
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/timetable")
    public ResponseEntity<Map<String, Object>> createTimetableSlot(
            @RequestParam String institutionId,
            @RequestBody Map<String, Object> payload) {
        String resId = resolveId(institutionId);
        String slotId = payload.get("slot_id") != null ? String.valueOf(payload.get("slot_id")) : "slot-" + UUID.randomUUID().toString().substring(0, 8);
        payload.put("slot_id", slotId);
        payload.put("id", slotId);
        payload.put("institution_id", resId);
        enrichTimetableSlot(resId, payload);

        syncToClassAssignment(resId, slotId, payload);

        try {
            String json = objectMapper.writeValueAsString(payload);
            CloudTenantEntity entity = CloudTenantEntity.builder()
                    .id(slotId)
                    .institutionId(resId)
                    .entityType("timetables")
                    .dataJson(json)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            tenantEntityRepo.save(entity);
            return ResponseEntity.ok(payload);
        } catch (Exception ex) {
            log.error("Failed to save timetable slot", ex);
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/timetable/{id}")
    public ResponseEntity<Map<String, Object>> updateTimetableSlot(
            @PathVariable String id,
            @RequestParam String institutionId,
            @RequestBody Map<String, Object> payload) {
        String resId = resolveId(institutionId);
        Optional<CloudTenantEntity> opt = tenantEntityRepo.findByInstitutionIdAndEntityTypeAndId(resId, "timetables", id);
        Map<String, Object> merged = new HashMap<>();
        if (opt.isPresent() && opt.get().getDataJson() != null) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> existing = objectMapper.readValue(opt.get().getDataJson(), Map.class);
                merged.putAll(existing);
            } catch (Exception ignored) {}
        }
        merged.putAll(payload);
        merged.put("slot_id", id);
        merged.put("id", id);
        merged.put("institution_id", resId);
        enrichTimetableSlot(resId, merged);

        syncToClassAssignment(resId, id, merged);

        try {
            String json = objectMapper.writeValueAsString(merged);
            CloudTenantEntity entity = opt.orElseGet(() -> CloudTenantEntity.builder()
                    .id(id)
                    .institutionId(resId)
                    .entityType("timetables")
                    .createdAt(Instant.now())
                    .build());
            entity.setDataJson(json);
            entity.setUpdatedAt(Instant.now());
            tenantEntityRepo.save(entity);
            return ResponseEntity.ok(merged);
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @Transactional
    @DeleteMapping("/timetable/{id}")
    public ResponseEntity<Map<String, Object>> deleteTimetableSlot(
            @PathVariable String id,
            @RequestParam String institutionId) {
        String resId = resolveId(institutionId);
        tenantEntityRepo.deleteByInstitutionIdAndEntityTypeAndId(resId, "timetables", id);
        classRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "deleted", id));
    }

    private void syncToClassAssignment(String resId, String slotId, Map<String, Object> payload) {
        try {
            String batchId = payload.get("batch_id") != null ? String.valueOf(payload.get("batch_id")) : "";
            String batchName = payload.get("batch_name") != null ? String.valueOf(payload.get("batch_name")) : "";
            if (batchName.isBlank() && !batchId.isBlank()) {
                Optional<CloudTenantEntity> bOpt = tenantEntityRepo.findByInstitutionIdAndEntityTypeAndId(resId, "batches", batchId);
                if (bOpt.isPresent()) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> bMap = objectMapper.readValue(bOpt.get().getDataJson(), Map.class);
                    batchName = String.valueOf(bMap.getOrDefault("batch_name", batchId));
                }
            }
            String subjectId = payload.get("subject_id") != null ? String.valueOf(payload.get("subject_id")) : "";
            String subjectName = payload.get("subject_name") != null ? String.valueOf(payload.get("subject_name")) : "";
            String subjectCode = payload.get("subject_code") != null ? String.valueOf(payload.get("subject_code")) : "";
            if ((subjectName.isBlank() || subjectCode.isBlank()) && !subjectId.isBlank()) {
                Optional<CloudTenantEntity> sOpt = tenantEntityRepo.findByInstitutionIdAndEntityTypeAndId(resId, "subjects", subjectId);
                if (sOpt.isPresent()) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> sMap = objectMapper.readValue(sOpt.get().getDataJson(), Map.class);
                    if (subjectName.isBlank()) subjectName = String.valueOf(sMap.getOrDefault("subject_name", subjectId));
                    if (subjectCode.isBlank()) subjectCode = String.valueOf(sMap.getOrDefault("subject_code", subjectId));
                }
            }
            String facultyId = payload.get("faculty_id") != null ? String.valueOf(payload.get("faculty_id")) : "";
            String facultyName = payload.get("faculty_name") != null ? String.valueOf(payload.get("faculty_name")) : "";
            if (facultyName.isBlank() && !facultyId.isBlank()) {
                Optional<CloudTeacher> tOpt = teacherRepo.findById(facultyId);
                if (tOpt.isPresent()) facultyName = tOpt.get().getName();
            }

            Integer dayOfWeek = 1;
            if (payload.get("day_of_week") != null) {
                try { dayOfWeek = Integer.parseInt(String.valueOf(payload.get("day_of_week"))); } catch (Exception ignored) {}
            }
            String startTime = payload.get("start_time") != null ? String.valueOf(payload.get("start_time")) : "09:00";
            String endTime = payload.get("end_time") != null ? String.valueOf(payload.get("end_time")) : "10:00";
            String room = payload.get("room") != null ? String.valueOf(payload.get("room")) : "";

            CloudClassAssignment assignment = CloudClassAssignment.builder()
                    .id(slotId)
                    .institutionId(resId)
                    .facultyId(facultyId)
                    .facultyName(facultyName)
                    .department(payload.get("department_name") != null ? String.valueOf(payload.get("department_name")) : "General")
                    .batchId(batchId)
                    .batchName(batchName.isBlank() ? "Batch" : batchName)
                    .subjectId(subjectId)
                    .subjectName(subjectName.isBlank() ? "Subject" : subjectName)
                    .subjectCode(subjectCode.isBlank() ? "SUB" : subjectCode)
                    .programName("Program")
                    .academicYearId(payload.get("academic_year_id") != null ? String.valueOf(payload.get("academic_year_id")) : "AY-2026")
                    .dayOfWeek(dayOfWeek)
                    .scheduleTime(startTime + " - " + endTime)
                    .room(room)
                    .version(1L)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            classRepo.save(assignment);
        } catch (Exception ex) {
            log.error("Failed to sync timetable slot to CloudClassAssignment", ex);
        }
    }

    // ─── Attendance Sessions & Live Marking ───

    @GetMapping("/sessions")
    public ResponseEntity<List<Map<String, Object>>> getSessions(
            @RequestParam(required = false, defaultValue = "") String institutionId) {
        String resId = resolveId(institutionId);
        if (resId.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<CloudAttendanceSession> sessions = sessionRepo.findByInstitutionId(resId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (CloudAttendanceSession s : sessions) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", s.getSessionId() != null ? s.getSessionId() : s.getId());
            map.put("session_id", s.getSessionId() != null ? s.getSessionId() : s.getId());
            map.put("sessionId", s.getSessionId() != null ? s.getSessionId() : s.getId());
            map.put("institution_id", resId);
            map.put("institutionId", resId);
            map.put("session_date", s.getSessionDate() != null ? s.getSessionDate().toString() : "");
            map.put("sessionDate", s.getSessionDate() != null ? s.getSessionDate().toString() : "");
            map.put("start_time", s.getStartTime() != null ? s.getStartTime() : "");
            map.put("startTime", s.getStartTime() != null ? s.getStartTime() : "");
            map.put("end_time", s.getEndTime() != null ? s.getEndTime() : "");
            map.put("endTime", s.getEndTime() != null ? s.getEndTime() : "");
            map.put("status", s.getStatus() != null ? s.getStatus() : "COMPLETED");
            map.put("batch_id", s.getBatchId());
            map.put("subject_id", s.getSubjectId());
            map.put("faculty_id", s.getFacultyId());
            map.put("custom_topic", s.getCustomTopic());

            // Lookup names
            String batchName = s.getBatchId();
            if (s.getBatchId() != null) {
                Optional<CloudTenantEntity> bOpt = tenantEntityRepo.findByInstitutionIdAndEntityTypeAndId(resId, "batches", s.getBatchId());
                if (bOpt.isPresent()) {
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> bMap = objectMapper.readValue(bOpt.get().getDataJson(), Map.class);
                        batchName = String.valueOf(bMap.getOrDefault("batch_name", s.getBatchId()));
                    } catch (Exception ignored) {}
                }
            }
            map.put("batch_name", batchName);
            map.put("batchName", batchName);

            String subjectName = s.getSubjectId();
            String subjectCode = "";
            if (s.getSubjectId() != null) {
                Optional<CloudTenantEntity> subOpt = tenantEntityRepo.findByInstitutionIdAndEntityTypeAndId(resId, "subjects", s.getSubjectId());
                if (subOpt.isPresent()) {
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> subMap = objectMapper.readValue(subOpt.get().getDataJson(), Map.class);
                        subjectName = String.valueOf(subMap.getOrDefault("subject_name", s.getSubjectId()));
                        subjectCode = String.valueOf(subMap.getOrDefault("subject_code", ""));
                    } catch (Exception ignored) {}
                }
            }
            map.put("subject_name", subjectName);
            map.put("subjectName", subjectName);
            map.put("subject_code", subjectCode);
            map.put("subjectCode", subjectCode);

            String facultyName = s.getFacultyId();
            if (s.getFacultyId() != null) {
                Optional<CloudTeacher> tOpt = teacherRepo.findById(s.getFacultyId());
                if (tOpt.isPresent()) facultyName = tOpt.get().getName();
            }
            map.put("faculty_name", facultyName);
            map.put("facultyName", facultyName);

            // Attendance counts from records
            List<CloudAttendanceRecord> records = recordRepo.findByInstitutionIdAndSessionId(resId, s.getSessionId());
            long total = records.size();
            long present = records.stream().filter(r -> "PRESENT".equalsIgnoreCase(r.getStatus())).count();
            long absent = records.stream().filter(r -> "ABSENT".equalsIgnoreCase(r.getStatus())).count();

            map.put("total_students", total);
            map.put("totalStudents", total);
            map.put("present_count", present);
            map.put("presentCount", present);
            map.put("absent_count", absent);
            map.put("absentCount", absent);

            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/sessions")
    public ResponseEntity<Map<String, Object>> createSession(
            @RequestParam String institutionId,
            @RequestBody Map<String, Object> payload) {
        String resId = resolveId(institutionId);
        String sessionId = payload.get("session_id") != null ? String.valueOf(payload.get("session_id"))
                : (payload.get("sessionId") != null ? String.valueOf(payload.get("sessionId")) : "sess-" + UUID.randomUUID().toString().substring(0, 8));

        String batchId = payload.get("batch_id") != null ? String.valueOf(payload.get("batch_id")) : "";
        String subjectId = payload.get("subject_id") != null ? String.valueOf(payload.get("subject_id")) : "";
        String facultyId = payload.get("faculty_id") != null ? String.valueOf(payload.get("faculty_id")) : "";
        String academicYearId = payload.get("academic_year_id") != null ? String.valueOf(payload.get("academic_year_id")) : "AY-2026";
        String startTime = payload.get("start_time") != null ? String.valueOf(payload.get("start_time")) : "09:00:00";
        String status = payload.get("status") != null ? String.valueOf(payload.get("status")) : "COMPLETED";
        String dateStr = payload.get("session_date") != null ? String.valueOf(payload.get("session_date")) : java.time.LocalDate.now().toString();
        java.time.LocalDate sessionDate = java.time.LocalDate.now();
        try { sessionDate = java.time.LocalDate.parse(dateStr); } catch (Exception ignored) {}

        CloudAttendanceSession session = CloudAttendanceSession.builder()
                .id(sessionId)
                .sessionId(sessionId)
                .institutionId(resId)
                .batchId(batchId)
                .subjectId(subjectId)
                .facultyId(facultyId)
                .academicYearId(academicYearId)
                .sessionDate(sessionDate)
                .startTime(startTime)
                .endTime(payload.get("end_time") != null ? String.valueOf(payload.get("end_time")) : startTime)
                .status(status)
                .customTopic(payload.get("topic_notes") != null ? String.valueOf(payload.get("topic_notes")) : null)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        sessionRepo.save(session);

        // Fetch students in this batch (or institution fallback)
        List<CloudStudentRoster> students = !batchId.isBlank()
                ? studentRepo.findByInstitutionIdAndBatchId(resId, batchId)
                : studentRepo.findByInstitutionId(resId);
        if (students.isEmpty()) {
            students = studentRepo.findByInstitutionId(resId);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> inputRecords = payload.get("records") instanceof List ? (List<Map<String, Object>>) payload.get("records") : null;

        for (CloudStudentRoster stu : students) {
            String stuStatus = "PRESENT";
            if (inputRecords != null) {
                Optional<Map<String, Object>> rOpt = inputRecords.stream().filter(r -> stu.getStudentId().equals(r.get("student_id")) || stu.getId().equals(r.get("student_id"))).findFirst();
                if (rOpt.isPresent()) {
                    stuStatus = String.valueOf(rOpt.get().getOrDefault("status", "PRESENT"));
                }
            }
            String recId = "rec-" + sessionId + "-" + stu.getStudentId();
            CloudAttendanceRecord rec = CloudAttendanceRecord.builder()
                    .id(recId)
                    .recordId(recId)
                    .sessionId(sessionId)
                    .institutionId(resId)
                    .studentId(stu.getStudentId())
                    .status(stuStatus)
                    .recognitionMethod("MANUAL_TEACHER")
                    .recordState("ACTIVE")
                    .markedAt(Instant.now())
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            recordRepo.save(rec);
        }

        Map<String, Object> resp = new LinkedHashMap<>(payload);
        resp.put("session_id", sessionId);
        resp.put("sessionId", sessionId);
        resp.put("id", sessionId);
        resp.put("status", status);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<Map<String, Object>> getSessionDetail(
            @PathVariable String sessionId,
            @RequestParam String institutionId) {
        String resId = resolveId(institutionId);
        Optional<CloudAttendanceSession> opt = sessionRepo.findByInstitutionIdAndSessionId(resId, sessionId);
        if (opt.isEmpty()) {
            opt = sessionRepo.findById(sessionId);
        }
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        CloudAttendanceSession s = opt.get();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("session_id", s.getSessionId());
        map.put("sessionId", s.getSessionId());
        map.put("session_date", s.getSessionDate() != null ? s.getSessionDate().toString() : "");
        map.put("start_time", s.getStartTime());
        map.put("end_time", s.getEndTime());
        map.put("status", s.getStatus());
        map.put("batch_id", s.getBatchId());
        map.put("subject_id", s.getSubjectId());
        map.put("faculty_id", s.getFacultyId());

        List<CloudAttendanceRecord> records = recordRepo.findByInstitutionIdAndSessionId(resId, s.getSessionId());
        List<CloudStudentRoster> allStudents = studentRepo.findByInstitutionId(resId);
        Map<String, CloudStudentRoster> stuMap = new HashMap<>();
        for (CloudStudentRoster stu : allStudents) {
            stuMap.put(stu.getStudentId(), stu);
            stuMap.put(stu.getId(), stu);
        }

        List<Map<String, Object>> recordList = new ArrayList<>();
        for (CloudAttendanceRecord r : records) {
            Map<String, Object> rMap = new LinkedHashMap<>();
            rMap.put("record_id", r.getRecordId());
            rMap.put("student_id", r.getStudentId());
            rMap.put("status", r.getStatus());
            rMap.put("marked_at", r.getMarkedAt() != null ? r.getMarkedAt().toString() : "");
            CloudStudentRoster stu = stuMap.get(r.getStudentId());
            if (stu != null) {
                rMap.put("student_name", stu.getName());
                rMap.put("admission_number", stu.getAdmissionNumber());
            } else {
                rMap.put("student_name", r.getStudentId());
                rMap.put("admission_number", "");
            }
            recordList.add(rMap);
        }
        map.put("records", recordList);
        return ResponseEntity.ok(map);
    }

    @PutMapping({"/sessions/{sessionId}/records/{recordId}", "/sessions/records/{recordId}"})
    public ResponseEntity<Map<String, Object>> updateSessionRecord(
            @PathVariable(required = false) String sessionId,
            @PathVariable String recordId,
            @RequestParam String institutionId,
            @RequestBody Map<String, Object> body) {
        Optional<CloudAttendanceRecord> opt = recordRepo.findById(recordId);
        if (opt.isPresent()) {
            CloudAttendanceRecord r = opt.get();
            if (body.get("status") != null) r.setStatus(String.valueOf(body.get("status")));
            r.setMarkedAt(Instant.now());
            r.setUpdatedAt(Instant.now());
            recordRepo.save(r);
            return ResponseEntity.ok(Map.of("success", true, "record", r));
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/sessions/{sessionId}/close")
    public ResponseEntity<Map<String, Object>> closeSession(
            @PathVariable String sessionId,
            @RequestParam String institutionId) {
        String resId = resolveId(institutionId);
        Optional<CloudAttendanceSession> opt = sessionRepo.findByInstitutionIdAndSessionId(resId, sessionId);
        if (opt.isPresent()) {
            CloudAttendanceSession s = opt.get();
            s.setStatus("COMPLETED");
            s.setEndTime(java.time.LocalTime.now().toString().substring(0, 8));
            s.setUpdatedAt(Instant.now());
            sessionRepo.save(s);
            return ResponseEntity.ok(Map.of("success", true, "status", "COMPLETED"));
        }
        return ResponseEntity.notFound().build();
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
