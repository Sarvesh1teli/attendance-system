package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudAppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CloudAppUserRepository extends JpaRepository<CloudAppUser, String> {
    List<CloudAppUser> findByInstitutionId(String institutionId);
    Optional<CloudAppUser> findByInstitutionIdAndUsername(String institutionId, String username);
    Optional<CloudAppUser> findByUsername(String username);
}
