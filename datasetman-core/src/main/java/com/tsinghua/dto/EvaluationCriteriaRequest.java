package com.tsinghua.dto;

import lombok.Data;

/**
 * 评价准则（权重配置）：完整性/准确性/一致性/时效性/规范性 五维权重，合计须为1。
 */
@Data
public class EvaluationCriteriaRequest {
    private Long id;
    private String name;
    private String description;
    private DataQualityDimension qcom;
    private DataQualityDimension qacc;
    private DataQualityDimension qcon;
    private DataQualityDimension qtim;
    private DataQualityDimension qconf;
    private String owner;
}
