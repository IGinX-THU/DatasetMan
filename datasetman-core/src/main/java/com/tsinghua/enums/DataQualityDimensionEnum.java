package com.tsinghua.enums;

import lombok.Getter;

@Getter
public enum DataQualityDimensionEnum {
    qcom("完整性"),
    qcon("一致性"),
    qtim("时效性"),
    qval("有效性");

    private final String label;

    DataQualityDimensionEnum(String label) {
        this.label = label;
    }
}
