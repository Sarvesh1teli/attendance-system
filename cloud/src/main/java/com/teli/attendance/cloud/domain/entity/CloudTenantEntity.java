package com.teli.attendance.cloud.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "cloud_tenant_entity", indexes = {
    @Index(name = "idx_tenant_entity_inst_type", columnList = "institution_id, entity_type")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudTenantEntity {

    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "institution_id", length = 128, nullable = false)
    private String institutionId;

    @Column(name = "entity_type", length = 64, nullable = false)
    private String entityType;

    @Column(name = "data_json", columnDefinition = "TEXT", nullable = false)
    private String dataJson;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
