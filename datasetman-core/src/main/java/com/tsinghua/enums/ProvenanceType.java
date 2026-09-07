package com.tsinghua.enums;

/**
 * 数据集版本的产出方式
 */
public enum ProvenanceType {
    /** 直接挂载已注册数据源（不复制数据，storagePath 指向源库前缀） */
    SOURCE("数据源挂载", "source"),
    /** 对上游版本执行 SELECT 后物化 */
    SELECT("SQL查询", "select"),
    /** 对上游版本执行含 UDF 的 SELECT 后物化 */
    SELECT_UDF("SQL+UDF处理", "udf"),
    /** Transform 作业产出后物化 */
    TRANSFORM_SQL("Transform变换", "transform");

    private final String label;
    /** 血缘边上的关系类型标注 */
    private final String relationType;

    ProvenanceType(String label, String relationType) {
        this.label = label;
        this.relationType = relationType;
    }

    public String getLabel() {
        return label;
    }

    public String getRelationType() {
        return relationType;
    }

    public static ProvenanceType of(String name) {
        for (ProvenanceType t : values()) {
            if (t.name().equalsIgnoreCase(name)) {
                return t;
            }
        }
        throw new IllegalArgumentException("未知的产出方式: " + name);
    }
}
