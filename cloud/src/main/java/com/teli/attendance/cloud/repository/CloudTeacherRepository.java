package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudTeacher;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CloudTeacherRepository extends JpaRepository<CloudTeacher, String> {
    List<CloudTeacher> findByInstitutionId(String institutionId);
    Optional<CloudTeacher> findByUsername(String username);
    Optional<CloudTeacher> findByEmployeeId(String employeeId);
    void deleteByInstitutionId(String institutionId);
}
