package com.tsinghua.dto;

import lombok.Data;

@Data
public class EvaluationCriteriaRequest {
    private Long id;
    private String name;
    private String description;
    private DataQualityDimension qcom;
    private DataQualityDimension qcon;
    private DataQualityDimension qtim;
    private DataQualityDimension qval;
    private String owner;
}
