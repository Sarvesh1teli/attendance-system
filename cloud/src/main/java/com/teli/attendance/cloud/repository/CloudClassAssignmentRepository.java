package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudClassAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CloudClassAssignmentRepository extends JpaRepository<CloudClassAssignment, String> {
    List<CloudClassAssignment> findByInstitutionId(String institutionId);
    List<CloudClassAssignment> findByInstitutionIdAndFacultyId(String institutionId, String facultyId);
}
