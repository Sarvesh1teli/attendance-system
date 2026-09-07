package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.TenantInstitution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TenantInstitutionRepository extends JpaRepository<TenantInstitution, String> {
    Optional<TenantInstitution> findByApiKey(String apiKey);
}
