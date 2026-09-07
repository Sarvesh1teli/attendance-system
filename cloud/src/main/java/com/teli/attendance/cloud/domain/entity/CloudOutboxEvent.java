package com.teli.attendance.cloud.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "cloud_outbox_event", indexes = {
    @Index(name = "idx_cloud_outbox_inst_id", columnList = "institutionId, id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudOutboxEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 64, nullable = false)
    private String institutionId;

    @Column(length = 64, nullable = false)
    private String eventType;

    @Column(length = 64, nullable = false)
    private String entityId;

    @Lob
    @Column(nullable = false)
    private String payload;

    @Column(nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
