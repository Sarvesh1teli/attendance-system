package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudOutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CloudOutboxEventRepository extends JpaRepository<CloudOutboxEvent, Long> {
    List<CloudOutboxEvent> findByInstitutionIdAndIdGreaterThanOrderByIdAsc(String institutionId, Long lastSeenId);
}
