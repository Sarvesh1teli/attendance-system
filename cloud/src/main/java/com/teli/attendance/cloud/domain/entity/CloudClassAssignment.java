package com.teli.attendance.cloud.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "cloud_class_assignment", indexes = {
    @Index(name = "idx_cloud_class_faculty", columnList = "institutionId, facultyId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudClassAssignment {
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String institutionId;

    @Column(length = 64, nullable = false)
    private String facultyId;

    private String facultyName;

    private String department;

    @Column(length = 64)
    private String employeeId;

    @Column(length = 64, nullable = false)
    private String batchId;

    @Column(nullable = false)
    private String batchName;

    @Column(length = 64, nullable = false)
    private String subjectId;

    @Column(nullable = false)
    private String subjectName;

    @Column(length = 64, nullable = false)
    private String subjectCode;

    @Column(nullable = false)
    private String programName;

    @Column(length = 64, nullable = false)
    private String academicYearId;

    @Column(length = 64)
    private String groupId;

    private String groupName;

    @Column(name = "day_of_week")
    private Integer dayOfWeek;

    @Column(length = 64)
    private String scheduleTime;

    @Column(length = 64)
    private String room;

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
