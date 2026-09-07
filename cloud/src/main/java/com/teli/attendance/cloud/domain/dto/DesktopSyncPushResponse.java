package com.teli.attendance.cloud.domain.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DesktopSyncPushResponse {
    private boolean success;
    private int topicsCount;
    private int studentsCount;
    private int classesCount;
    private String message;
}
