package com.teli.attendance.cloud.domain.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PwaSyncPushResponse {
    private boolean success;
    private String sessionId;
    private int recordsProcessed;
    private int conflictsEncountered;
    private String message;
}
