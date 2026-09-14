package com.tsinghua.enums;

import lombok.Getter;

/**
 * 质量测评维度（对齐 GB/T 36344—2018 与课题测试方案 4.3.2.2）：
 * 完整性/准确性/一致性/时效性/规范性 共5个维度，默认权重各20%。
 */
@Getter
public enum DataQualityDimensionEnum {
    qcom("完整性", "Completeness", "非空单元格占比"),
    qacc("准确性", "Accuracy", "数值正负/取值域/枚举合法等语义规则通过率"),
    qcon("一致性", "Consistency", "行唯一性与同列类型冲突率"),
    qtim("时效性", "Timeliness", "数据最新记录年龄"),
    qconf("规范性", "Conformity", "日期/ID等格式规范符合率");

    private final String label;
    private final String english;
    private final String rule;

    DataQualityDimensionEnum(String label, String english, String rule) {
        this.label = label;
        this.english = english;
        this.rule = rule;
    }
}
