package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudSyncConflict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CloudSyncConflictRepository extends JpaRepository<CloudSyncConflict, String> {
    List<CloudSyncConflict> findByInstitutionIdAndResolvedFalse(String institutionId);
}
