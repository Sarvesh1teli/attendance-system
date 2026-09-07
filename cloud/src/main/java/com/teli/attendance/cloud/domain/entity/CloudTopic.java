package com.teli.attendance.cloud.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "cloud_topic", indexes = {
    @Index(name = "idx_cloud_topic_inst_subj", columnList = "institutionId, subjectId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudTopic {
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String institutionId;

    @Column(length = 64, nullable = false)
    private String subjectId;

    @Column(nullable = false)
    private String topicName;

    private String unitName;

    private Integer sequenceNumber;

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
