package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudAttendanceSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface CloudAttendanceSessionRepository extends JpaRepository<CloudAttendanceSession, String> {
    List<CloudAttendanceSession> findByInstitutionId(String institutionId);
    Optional<CloudAttendanceSession> findByInstitutionIdAndSessionId(String institutionId, String sessionId);
    List<CloudAttendanceSession> findByInstitutionIdAndSessionDate(String institutionId, LocalDate sessionDate);
    List<CloudAttendanceSession> findByInstitutionIdAndUpdatedAtAfter(String institutionId, Instant updatedAt);
}

