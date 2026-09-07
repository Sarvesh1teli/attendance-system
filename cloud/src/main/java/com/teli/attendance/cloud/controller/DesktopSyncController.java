package com.teli.attendance.cloud.controller;

import com.teli.attendance.cloud.domain.dto.DesktopSyncPullResponse;
import com.teli.attendance.cloud.domain.dto.DesktopSyncPushRequest;
import com.teli.attendance.cloud.domain.dto.DesktopSyncPushResponse;
import com.teli.attendance.cloud.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sync/desktop")
@RequiredArgsConstructor
public class DesktopSyncController {

    private final SyncService syncService;

    @PostMapping("/push")
    public ResponseEntity<DesktopSyncPushResponse> pushMasterData(@RequestBody DesktopSyncPushRequest request) {
        DesktopSyncPushResponse response = syncService.processDesktopPush(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/pull")
    public ResponseEntity<DesktopSyncPullResponse> pullCompletedSessions(
            @RequestParam(defaultValue = "inst-001") String institutionId,
            @RequestParam(required = false) String sessionDate,
            @RequestParam(required = false) String since) {
        DesktopSyncPullResponse response = syncService.getDesktopPullData(institutionId, sessionDate, since);
        return ResponseEntity.ok(response);
    }
}
