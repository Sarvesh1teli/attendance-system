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

    @GetMapping("/pull")
    public ResponseEntity<PwaSyncPullResponse> pullData(
            @RequestParam(defaultValue = "inst-001") String institutionId,
            @RequestParam(required = false) String facultyId) {
        PwaSyncPullResponse response = syncService.getPwaPullData(institutionId, facultyId);
        return ResponseEntity.ok(response);
    }
}
