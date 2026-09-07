package com.teli.attendance.cloud.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "cloud_sync_conflict", indexes = {
    @Index(name = "idx_cloud_conflict_inst", columnList = "institutionId, resolved")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudSyncConflict {
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String institutionId;

    @Column(length = 64, nullable = false)
    private String entityType;

    @Column(length = 64, nullable = false)
    private String entityId;

    @Column(nullable = false)
    private Long incomingVersion;

    @Column(nullable = false)
    private Long storedVersion;

    @Lob
    @Column(nullable = false)
    private String incomingPayload;

    @Lob
    @Column(nullable = false)
    private String storedPayload;

    @Column(length = 64, nullable = false)
    @Builder.Default
    private String resolutionStrategy = "LOG_AND_STORED_WINS";

    @Column(nullable = false)
    @Builder.Default
    private Boolean resolved = false;

    @Column(nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
