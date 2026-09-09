package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudTenantEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CloudTenantEntityRepository extends JpaRepository<CloudTenantEntity, String> {
    List<CloudTenantEntity> findByInstitutionId(String institutionId);
    List<CloudTenantEntity> findByInstitutionIdAndEntityType(String institutionId, String entityType);
    Optional<CloudTenantEntity> findByInstitutionIdAndEntityTypeAndId(String institutionId, String entityType, String id);
    void deleteByInstitutionIdAndEntityTypeAndId(String institutionId, String entityType, String id);
    void deleteByInstitutionId(String institutionId);
}

