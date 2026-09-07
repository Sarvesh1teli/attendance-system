package com.teli.attendance.cloud.repository;

import com.teli.attendance.cloud.domain.entity.CloudTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CloudTopicRepository extends JpaRepository<CloudTopic, String> {
    List<CloudTopic> findByInstitutionId(String institutionId);
    List<CloudTopic> findByInstitutionIdAndSubjectId(String institutionId, String subjectId);
}
