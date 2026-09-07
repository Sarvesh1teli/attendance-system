package com.teli.attendance.cloud.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "cloud_attendance_record",
    uniqueConstraints = @UniqueConstraint(name = "uq_cloud_record_sess_stu", columnNames = {"institutionId", "sessionId", "studentId"}),
    indexes = @Index(name = "idx_cloud_record_session", columnList = "institutionId, sessionId")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudAttendanceRecord {
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String recordId;

    @Column(length = 64, nullable = false)
    private String sessionId;

    @Column(length = 64, nullable = false)
    private String institutionId;

    @Column(length = 64, nullable = false)
    private String studentId;

    @Column(length = 32, nullable = false)
    private String status; // 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'

    @Column(length = 32, nullable = false)
    private String recognitionMethod; // 'SYSTEM_DEFAULT', 'MANUAL_TEACHER', 'FACE_RECOGNITION'

    @Column(length = 32, nullable = false)
    @Builder.Default
    private String recordState = "ACTIVE"; // 'ACTIVE' or 'VOIDED'

    @Column(precision = 5, scale = 4)
    private BigDecimal confidenceScore;

    @Column(nullable = false)
    private Instant markedAt;

    @Column(nullable = false)
    @Builder.Default
    private Long version = 1L;

    @Column(nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
