package com.teli.attendance.cloud.domain.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PwaSyncPushRequest {
    private String institutionId;
    private SessionDto session;
    private List<RecordDto> records;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SessionDto {
        private String sessionId;
        private String facultyId;
        private String subjectId;
        private String batchId;
        private String academicYearId;
        private String studentGroupId;
        private LocalDate sessionDate;
        private String startTime;
        private String endTime;
        private String status;
        private String topicId;
        private String customTopic;
        private Long version;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RecordDto {
        private String recordId;
        private String studentId;
        private String status; // PRESENT, ABSENT, LATE, EXCUSED
        private String recognitionMethod;
        private String recordState; // ACTIVE, VOIDED
        private BigDecimal confidenceScore;
        private Instant markedAt;
        private Long version;
    }
}
