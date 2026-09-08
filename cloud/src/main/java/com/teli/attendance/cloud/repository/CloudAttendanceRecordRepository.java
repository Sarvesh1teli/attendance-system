package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudAttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CloudAttendanceRecordRepository extends JpaRepository<CloudAttendanceRecord, String> {
    List<CloudAttendanceRecord> findByInstitutionId(String institutionId);
    List<CloudAttendanceRecord> findByInstitutionIdAndSessionId(String institutionId, String sessionId);
    Optional<CloudAttendanceRecord> findByInstitutionIdAndSessionIdAndStudentId(String institutionId, String sessionId, String studentId);
}
