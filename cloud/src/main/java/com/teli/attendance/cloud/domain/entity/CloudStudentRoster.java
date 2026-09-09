package com.teli.attendance.cloud.domain.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "cloud_student_roster",
    uniqueConstraints = @UniqueConstraint(name = "uq_cloud_student_inst", columnNames = {"institutionId", "studentId"}),
    indexes = @Index(name = "idx_cloud_student_batch", columnList = "institutionId, batchId")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class CloudStudentRoster {
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String institutionId;

    @Column(length = 64, nullable = false)
    private String studentId;

    @Column(length = 64, nullable = false)
    private String batchId;

    @Column(nullable = false)
    private String name;

    @Column(length = 64, nullable = false)
    private String admissionNumber;

    @Column(length = 16)
    private String gender;

    @Column(nullable = false)
    @Builder.Default
    private Boolean faceEnrolled = false;

    @Column(columnDefinition = "TEXT")
    private String faceDescriptor;

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
