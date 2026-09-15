package com.tsinghua.dto;

import lombok.Data;

/**
 * 评价准则（权重配置）：完整性/一致性/时效性/有效性 四维权重，合计须为1。
 */
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
