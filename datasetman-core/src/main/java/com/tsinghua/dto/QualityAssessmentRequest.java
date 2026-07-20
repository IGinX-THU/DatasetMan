package com.tsinghua.dto;

import lombok.Data;

@Data
public class QualityAssessmentRequest {
    private Long id;
    private Long criteriaId;
    private String criteriaName;
    private String description;
    private DataQualityDimension qcom;
    private DataQualityDimension qcon;
    private DataQualityDimension qtim;
    private DataQualityDimension qval;
    private String dqi;
    private String passed;
    private String owner;
}
