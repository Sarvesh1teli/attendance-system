package com.teli.attendance.cloud.domain.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "cloud_teacher")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class CloudTeacher {
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String institutionId;

    @Column(nullable = false)
    private String name;

    @Column(length = 64)
    private String employeeId;

    @Column(length = 64)
    private String username;

    @Column(length = 20)
    private String pin;

    @Column(length = 255)
    private String passwordHash;

    @Column(columnDefinition = "TEXT")
    private String faceDescriptor;

    private String department;

    private String institutionName;

    @Column(nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
