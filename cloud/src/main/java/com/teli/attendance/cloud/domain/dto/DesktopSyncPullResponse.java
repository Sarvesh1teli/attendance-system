package com.teli.attendance.cloud.domain.dto;

import com.teli.attendance.cloud.domain.entity.CloudAttendanceRecord;
import com.teli.attendance.cloud.domain.entity.CloudAttendanceSession;
import com.teli.attendance.cloud.domain.entity.CloudSyncConflict;
import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DesktopSyncPullResponse {
    private String institutionId;
    private List<CloudAttendanceSession> sessions;
    private List<CloudAttendanceRecord> records;
    private List<CloudSyncConflict> conflicts;
}
