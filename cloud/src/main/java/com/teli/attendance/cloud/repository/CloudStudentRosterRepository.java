package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudStudentRoster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CloudStudentRosterRepository extends JpaRepository<CloudStudentRoster, String> {
    List<CloudStudentRoster> findByInstitutionId(String institutionId);
    List<CloudStudentRoster> findByInstitutionIdAndBatchId(String institutionId, String batchId);
    Optional<CloudStudentRoster> findByInstitutionIdAndStudentId(String institutionId, String studentId);
}
