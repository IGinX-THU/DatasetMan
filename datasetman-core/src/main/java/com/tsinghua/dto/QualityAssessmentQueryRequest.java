package com.tsinghua.dto;

import lombok.Data;

@Data
public class QualityAssessmentQueryRequest {
    private Integer pageNum = 1;
    private Integer pageSize = 100;
    private String criteriaName;
}
