package com.teli.attendance.cloud.controller;

import com.teli.attendance.cloud.domain.dto.PwaSyncPullResponse;
import com.teli.attendance.cloud.domain.dto.PwaSyncPushRequest;
import com.teli.attendance.cloud.domain.dto.PwaSyncPushResponse;
import com.teli.attendance.cloud.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sync/pwa")
@RequiredArgsConstructor
public class PwaSyncController {

    private final SyncService syncService;

    @PostMapping("/push")
    public ResponseEntity<PwaSyncPushResponse> pushSession(@RequestBody PwaSyncPushRequest request) {
        PwaSyncPushResponse response = syncService.processPwaPush(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<java.util.Map<String, Object>> loginTeacher(@RequestBody java.util.Map<String, String> request) {
        String username = request.get("username");
        if (username == null || username.isBlank()) {
            username = request.get("identifier");
        }
        var teacherOpt = syncService.authenticateTeacher(username);
        if (teacherOpt.isPresent()) {
            var t = teacherOpt.get();
            return ResponseEntity.ok(java.util.Map.of(
                    "success", true,
                    "teacher", java.util.Map.of(
                            "id", t.getId(),
                            "name", t.getName(),
                            "employee_id", t.getEmployeeId() != null ? t.getEmployeeId() : "",
                            "username", t.getUsername() != null ? t.getUsername() : "",
                            "department", t.getDepartment() != null ? t.getDepartment() : "General",
                            "institution_name", t.getInstitutionName() != null ? t.getInstitutionName() : "Institution",
                            "institution_id", t.getInstitutionId()
                    )
            ));
        }
        return ResponseEntity.ok(java.util.Map.of(
                "success", false,
                "error", "Teacher account not found for username/ID: " + (username != null ? username : "")
        ));
    }

    @GetMapping("/pull")
    public ResponseEntity<PwaSyncPullResponse> pullData(
            @RequestParam(defaultValue = "inst-001") String institutionId,
            @RequestParam(required = false) String facultyId) {
        PwaSyncPullResponse response = syncService.getPwaPullData(institutionId, facultyId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset")
    public ResponseEntity<java.util.Map<String, Object>> resetData(
            @RequestParam(required = false) String institutionId) {
        syncService.resetAllData(institutionId);
        return ResponseEntity.ok(java.util.Map.of("success", true, "message", "All cloud sync data dropped successfully"));
    }

    @DeleteMapping("/reset")
    public ResponseEntity<java.util.Map<String, Object>> deleteResetData(
            @RequestParam(required = false) String institutionId) {
        syncService.resetAllData(institutionId);
        return ResponseEntity.ok(java.util.Map.of("success", true, "message", "All cloud sync data dropped successfully"));
    }
}
