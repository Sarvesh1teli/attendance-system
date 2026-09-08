package com.teli.attendance.cloud.domain.dto;

import com.teli.attendance.cloud.domain.entity.CloudClassAssignment;
import com.teli.attendance.cloud.domain.entity.CloudStudentRoster;
import com.teli.attendance.cloud.domain.entity.CloudTeacher;
import com.teli.attendance.cloud.domain.entity.CloudTopic;
import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PwaSyncPullResponse {
    private String institutionId;
    private List<CloudClassAssignment> classes;
    private List<CloudTopic> topics;
    private List<CloudStudentRoster> students;
    private List<CloudTeacher> teachers;
}
