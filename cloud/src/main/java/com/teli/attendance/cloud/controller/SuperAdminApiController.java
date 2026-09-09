package com.teli.attendance.cloud.controller;

import com.teli.attendance.cloud.domain.entity.*;
import com.teli.attendance.cloud.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/superadmin")
@RequiredArgsConstructor
public class SuperAdminApiController {

    private final TenantInstitutionRepository tenantRepo;
    private final CloudAppUserRepository appUserRepo;
    private final CloudTeacherRepository teacherRepo;
    private final CloudStudentRosterRepository studentRepo;
    private final CloudClassAssignmentRepository classRepo;
    private final CloudAttendanceSessionRepository sessionRepo;
    private final CloudAttendanceRecordRepository recordRepo;
    private final CloudTopicRepository topicRepo;
    private final CloudTenantEntityRepository tenantEntityRepo;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Get platform overview metrics for the Super Admin Dashboard.
     * Matches the 5 colored KPI cards: Total Customers, Pending Approvals, Active Trials, Paid Subscriptions, Suspended.
     */
    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getOverview() {
        List<TenantInstitution> tenants = tenantRepo.findAll().stream()
                .filter(t -> !"PLATFORM".equalsIgnoreCase(t.getId()))
                .toList();

        long totalCustomers = tenants.size();

        long pendingApprovals = tenants.stream()
                .filter(t -> "PENDING".equalsIgnoreCase(t.getStatus()) || "PENDING_APPROVAL".equalsIgnoreCase(t.getPlan()))
                .count();

        long activeTrials = tenants.stream()
                .filter(t -> t.getPlan() != null && t.getPlan().toUpperCase().contains("TRIAL") && !"SUSPENDED".equalsIgnoreCase(t.getStatus()))
                .count();

        long paidSubscriptions = tenants.stream()
                .filter(t -> t.getPlan() != null && t.getPlan().toUpperCase().contains("ANNUAL") && !"SUSPENDED".equalsIgnoreCase(t.getStatus()))
                .count();

        long suspended = tenants.stream()
                .filter(t -> "SUSPENDED".equalsIgnoreCase(t.getStatus()))
                .count();

        return ResponseEntity.ok(Map.of(
                "totalCustomers", totalCustomers,
                "pendingApprovals", pendingApprovals,
                "activeTrials", activeTrials,
                "paidSubscriptions", paidSubscriptions,
                "suspended", suspended,
                "platformStatus", "HEALTHY"
        ));
    }

    /**
     * List all customer accounts for the Customer Account Manifest.
     */
    @GetMapping("/institutions")
    public ResponseEntity<List<Map<String, Object>>> listInstitutions() {
        List<TenantInstitution> tenants = tenantRepo.findAll().stream()
                .filter(t -> !"PLATFORM".equalsIgnoreCase(t.getId()))
                .toList();
        List<Map<String, Object>> result = new ArrayList<>();

        for (TenantInstitution t : tenants) {
            String instId = t.getId();
            long students = studentRepo.findByInstitutionId(instId).size();
            long teachers = teacherRepo.findByInstitutionId(instId).size();
            long sessions = sessionRepo.findByInstitutionId(instId).size();

            // Fallback lookup via teacher institution name
            if (teachers == 0 && students == 0) {
                for (CloudTeacher ct : teacherRepo.findAll()) {
                    if (instId.equalsIgnoreCase(ct.getInstitutionName()) && ct.getInstitutionId() != null) {
                        teachers = teacherRepo.findByInstitutionId(ct.getInstitutionId()).size();
                        students = studentRepo.findByInstitutionId(ct.getInstitutionId()).size();
                        break;
                    }
                }
            }

            // Find associated admin user if present
            String adminUser = "admin";
            Optional<CloudAppUser> userOpt = appUserRepo.findByInstitutionIdAndUsername(instId, "admin");
            if (userOpt.isPresent()) {
                adminUser = userOpt.get().getUsername();
            }

            Map<String, Object> map = new HashMap<>();
            map.put("id", t.getId());
            map.put("name", t.getName());
            map.put("phone", t.getPhone() != null ? t.getPhone() : "+91 80 2345 6789");
            map.put("email", t.getEmail() != null ? t.getEmail() : instId + ".attendance.telicampus.in");
            map.put("adminName", t.getAdminName() != null ? t.getAdminName() : "College Administrator");
            map.put("adminEmail", t.getAdminEmail() != null ? t.getAdminEmail() : "admin@" + instId + ".telicampus.in");
            map.put("adminUsername", adminUser);
            map.put("plan", t.getPlan() != null ? t.getPlan() : "ANNUAL_ENTERPRISE");
            map.put("status", t.getStatus() != null ? t.getStatus() : "ACTIVE");
            map.put("apiKey", t.getApiKey());
            map.put("createdAt", t.getCreatedAt());
            map.put("studentCount", students);
            map.put("teacherCount", teachers);
            map.put("sessionCount", sessions);
            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Onboard a new customer / institution and create their first Admin account.
     */
    @PostMapping("/institutions")
    public ResponseEntity<Map<String, Object>> createInstitution(@RequestBody Map<String, String> body) {
        String code = body.get("id");
        String name = body.get("name");
        String phone = body.get("phone");
        String email = body.get("email");
        String adminName = body.get("adminName");
        String adminEmail = body.get("adminEmail");
        String adminUsername = body.get("adminUsername");
        String adminPassword = body.get("adminPassword");
        String plan = body.get("plan");

        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "College / Institution Code is required (e.g. oxford)"));
        }
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Institution Name is required"));
        }

        String cleanCode = code.trim().toLowerCase().replaceAll("[^a-z0-9_-]", "");
        String cleanName = name.trim();
        String cleanUser = (adminUsername != null && !adminUsername.isBlank()) ? adminUsername.trim() : "admin";
        String cleanPass = (adminPassword != null && !adminPassword.isBlank()) ? adminPassword.trim() : "admin123";
        String cleanPlan = (plan != null && !plan.isBlank()) ? plan.trim().toUpperCase() : "ANNUAL_ENTERPRISE";

        if (tenantRepo.findById(cleanCode).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Institution code '" + cleanCode + "' already exists"));
        }

        TenantInstitution tenant = TenantInstitution.builder()
                .id(cleanCode)
                .name(cleanName)
                .phone(phone != null ? phone.trim() : "+91 98765 43210")
                .email(email != null ? email.trim() : cleanCode + ".telicampus.in")
                .adminName(adminName != null ? adminName.trim() : cleanUser.toUpperCase())
                .adminEmail(adminEmail != null ? adminEmail.trim() : cleanUser + "@" + cleanCode + ".com")
                .plan(cleanPlan)
                .apiKey("api_key_" + cleanCode + "_" + UUID.randomUUID().toString().substring(0, 8))
                .status("ACTIVE")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        tenantRepo.save(tenant);

        CloudAppUser adminUserEntity = CloudAppUser.builder()
                .id("usr-" + cleanCode + "-admin")
                .institutionId(cleanCode)
                .username(cleanUser)
                .passwordHash(cleanPass)
                .role("ADMIN")
                .status("ACTIVE")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        appUserRepo.save(adminUserEntity);

        log.info("[SuperAdmin] Onboarded institution {} ({}) on plan {}", cleanName, cleanCode, cleanPlan);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Institution '" + cleanName + "' onboarded successfully",
                "institution", Map.of(
                        "id", cleanCode,
                        "name", cleanName,
                        "plan", cleanPlan,
                        "adminUsername", cleanUser,
                        "adminPassword", cleanPass
                )
        ));
    }

    /**
     * Action: Approve Annual Enterprise plan
     */
    @PostMapping("/institutions/{id}/approve-annual")
    public ResponseEntity<Map<String, Object>> approveAnnual(@PathVariable String id) {
        Optional<TenantInstitution> opt = tenantRepo.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        TenantInstitution t = opt.get();
        t.setPlan("ANNUAL_ENTERPRISE");
        t.setStatus("ACTIVE");
        t.setUpdatedAt(Instant.now());
        tenantRepo.save(t);

        return ResponseEntity.ok(Map.of("success", true, "message", "Annual Enterprise plan approved for " + t.getName(), "plan", "ANNUAL_ENTERPRISE"));
    }

    /**
     * Action: Extend 14-Day Free Trial
     */
    @PostMapping("/institutions/{id}/extend-trial")
    public ResponseEntity<Map<String, Object>> extendTrial(@PathVariable String id) {
        Optional<TenantInstitution> opt = tenantRepo.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        TenantInstitution t = opt.get();
        t.setPlan("TRIAL_14_DAYS");
        t.setStatus("ACTIVE");
        t.setUpdatedAt(Instant.now());
        tenantRepo.save(t);

        return ResponseEntity.ok(Map.of("success", true, "message", "14-Day Trial extended for " + t.getName(), "plan", "TRIAL_14_DAYS"));
    }

    /**
     * Action: Toggle Suspend / Activate
     */
    @PostMapping("/institutions/{id}/suspend")
    public ResponseEntity<Map<String, Object>> toggleSuspend(@PathVariable String id) {
        Optional<TenantInstitution> opt = tenantRepo.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        TenantInstitution t = opt.get();
        String newStatus = "SUSPENDED".equalsIgnoreCase(t.getStatus()) ? "ACTIVE" : "SUSPENDED";
        t.setStatus(newStatus);
        t.setUpdatedAt(Instant.now());
        tenantRepo.save(t);

        return ResponseEntity.ok(Map.of("success", true, "status", newStatus, "message", "Account status updated to " + newStatus));
    }

    /**
     * Action: Generate Temporary Password
     */
    @PostMapping("/institutions/{id}/temp-password")
    public ResponseEntity<Map<String, Object>> generateTempPassword(@PathVariable String id) {
        Optional<TenantInstitution> opt = tenantRepo.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        String tempPass = "Temp@" + (1000 + new Random().nextInt(9000));
        Optional<CloudAppUser> userOpt = appUserRepo.findByInstitutionIdAndUsername(id, "admin");
        if (userOpt.isPresent()) {
            CloudAppUser u = userOpt.get();
            u.setPasswordHash(tempPass);
            u.setUpdatedAt(Instant.now());
            appUserRepo.save(u);
        } else {
            // Create admin user if not found
            appUserRepo.save(CloudAppUser.builder()
                    .id("usr-" + id + "-admin")
                    .institutionId(id)
                    .username("admin")
                    .passwordHash(tempPass)
                    .role("ADMIN")
                    .status("ACTIVE")
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build());
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "tempPassword", tempPass,
                "username", "admin",
                "institutionId", id,
                "message", "Temporary password generated: " + tempPass
        ));
    }

    /**
     * Delete an institution and its associated cloud records.
     */
    @DeleteMapping("/institutions/{id}")
    public ResponseEntity<Map<String, Object>> deleteInstitution(@PathVariable String id) {
        if ("PLATFORM".equalsIgnoreCase(id)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Cannot delete core platform: " + id));
        }

        tenantRepo.deleteById(id);
        List<CloudAppUser> users = appUserRepo.findAll().stream()
                .filter(u -> id.equalsIgnoreCase(u.getInstitutionId()))
                .toList();
        appUserRepo.deleteAll(users);

        // Delete all tenant-scoped data
        tenantEntityRepo.deleteAll(tenantEntityRepo.findByInstitutionId(id));
        studentRepo.deleteAll(studentRepo.findByInstitutionId(id));
        teacherRepo.deleteAll(teacherRepo.findByInstitutionId(id));
        classRepo.deleteAll(classRepo.findByInstitutionId(id));
        topicRepo.deleteAll(topicRepo.findByInstitutionId(id));
        sessionRepo.deleteAll(sessionRepo.findByInstitutionId(id));
        recordRepo.deleteAll(recordRepo.findByInstitutionId(id));

        return ResponseEntity.ok(Map.of("success", true, "message", "Institution " + id + " removed"));
    }

    /**
     * Fresh Start / Data Reset
     */
    @PostMapping("/system/reset-data")
    public ResponseEntity<Map<String, Object>> resetData() {
        log.warn("[SuperAdmin] Purging cloud data for fresh deployment...");

        try {
            recordRepo.deleteAll();
            sessionRepo.deleteAll();
            studentRepo.deleteAll();
            classRepo.deleteAll();
            teacherRepo.deleteAll();
            topicRepo.deleteAll();
            tenantEntityRepo.deleteAll();

            for (TenantInstitution t : tenantRepo.findAll()) {
                if (!"PLATFORM".equalsIgnoreCase(t.getId())) {
                    tenantRepo.delete(t);
                }
            }

            for (CloudAppUser u : appUserRepo.findAll()) {
                if (!"PLATFORM".equalsIgnoreCase(u.getInstitutionId()) && !"superadmin".equalsIgnoreCase(u.getUsername())) {
                    appUserRepo.delete(u);
                }
            }

            Optional<CloudAppUser> superOpt = appUserRepo.findByInstitutionIdAndUsername("PLATFORM", "superadmin");
            if (superOpt.isEmpty()) {
                appUserRepo.save(CloudAppUser.builder()
                        .id("usr-superadmin-01")
                        .institutionId("PLATFORM")
                        .username("superadmin")
                        .passwordHash("admin123")
                        .role("SUPER_ADMIN")
                        .status("ACTIVE")
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build());
            } else {
                CloudAppUser su = superOpt.get();
                su.setPasswordHash("admin123");
                appUserRepo.save(su);
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Cloud database reset successfully. Super Admin (superadmin / admin123) preserved."
            ));
        } catch (Exception e) {
            log.error("[SuperAdmin] Reset failed: ", e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}
