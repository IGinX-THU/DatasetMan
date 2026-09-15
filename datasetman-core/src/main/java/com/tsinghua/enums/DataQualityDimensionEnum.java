package com.tsinghua.enums;

import lombok.Getter;

/**
 * 质量测评维度（对齐 GB/T 36344—2018 与课题测试方案 4.3.1.6 数据质量综合指标）：
 * 完整性/一致性/时效性/有效性 共4个维度，DQI 为加权综合得分（权重和为1），达标线95分。
 */
@Getter
public enum DataQualityDimensionEnum {
    qcom("完整性", "Completeness", "必填字段、关键记录、关联元数据齐备（空值占比）"),
    qcon("一致性", "Consistency", "跨源/跨表字段口径、编码一致（行唯一性/重复率）"),
    qtim("时效性", "Timeliness", "采集时间、入库时间、业务有效期满足场景要求（数据年龄）"),
    qval("有效性", "Validity", "字段格式、取值范围、枚举编码、数据类型符合规则");

    private final String label;
    private final String english;
    private final String rule;

    DataQualityDimensionEnum(String label, String english, String rule) {
        this.label = label;
        this.english = english;
        this.rule = rule;
    }
}
