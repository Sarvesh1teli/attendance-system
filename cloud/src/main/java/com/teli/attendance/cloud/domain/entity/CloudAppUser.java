package com.teli.attendance.cloud.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "cloud_app_user")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudAppUser {
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String institutionId;

    @Column(length = 64, nullable = false)
    private String username;

    @Column(length = 255, nullable = false)
    private String passwordHash;

    @Column(length = 32, nullable = false)
    @Builder.Default
    private String role = "ADMIN";

    @Column(length = 32, nullable = false)
    @Builder.Default
    private String status = "ACTIVE";

    private Instant lastLogin;

    @Column(nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
