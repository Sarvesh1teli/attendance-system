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
    private final AuthController authController;

    @PostMapping("/push")
    public ResponseEntity<PwaSyncPushResponse> pushSession(@RequestBody PwaSyncPushRequest request) {
        PwaSyncPushResponse response = syncService.processPwaPush(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<java.util.Map<String, Object>> loginTeacher(@RequestBody java.util.Map<String, String> request) {
        return authController.teacherLogin(request);
    }

    @GetMapping("/pull")
    public ResponseEntity<PwaSyncPullResponse> pullData(
            @RequestParam(required = false, defaultValue = "") String institutionId,
            @RequestParam(required = false) String facultyId) {
        if (institutionId == null || institutionId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
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
