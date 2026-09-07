package com.teli.attendance.cloud.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "cloud_attendance_session",
    uniqueConstraints = @UniqueConstraint(name = "uq_cloud_session_inst_sess", columnNames = {"institutionId", "sessionId"}),
    indexes = @Index(name = "idx_cloud_session_date", columnList = "institutionId, sessionDate")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudAttendanceSession {
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String sessionId;

    @Column(length = 64, nullable = false)
    private String institutionId;

    @Column(length = 64, nullable = false)
    private String facultyId;

    @Column(length = 64, nullable = false)
    private String subjectId;

    @Column(length = 64, nullable = false)
    private String batchId;

    @Column(length = 64, nullable = false)
    private String academicYearId;

    @Column(length = 64)
    private String studentGroupId;

    @Column(nullable = false)
    private LocalDate sessionDate;

    @Column(length = 32, nullable = false)
    private String startTime;

    @Column(length = 32)
    private String endTime;

    @Column(length = 32, nullable = false)
    private String status; // 'OPEN', 'COMPLETED', 'CANCELLED'

    @Column(length = 64)
    private String topicId;

    private String customTopic;

    @Column(length = 64)
    @Builder.Default
    private String sourceDevice = "TEACHER_PWA";

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
