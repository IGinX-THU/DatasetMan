package com.tsinghua.enums;

/**
 * 数据集版本的产出方式
 */
public enum ProvenanceType {
    /** 直接挂载已注册数据源（不复制数据，storagePath 指向源库前缀） */
    SOURCE("数据源挂载", "source"),
    /** 导入 CSV 等文件数据到 IginX，物化为新数据集 */
    IMPORT("导入数据", "import"),
    /** 选取 SQL 脚本或直接执行 SQL 语句（可包含 UDF 转换）物化为新数据集 */
    SQL_QUERY("SQL查询/转换", "sql"),
    /** Transform 作业产出后物化 */
    TRANSFORM("Transform变换", "transform");

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
        if (name == null) {
            throw new IllegalArgumentException("产出方式不能为空");
        }
        // 兼容旧枚举标识映射
        if ("SELECT".equalsIgnoreCase(name) || "SELECT_UDF".equalsIgnoreCase(name)) {
            return SQL_QUERY;
        }
        if ("TRANSFORM_SQL".equalsIgnoreCase(name)) {
            return TRANSFORM;
        }
        for (ProvenanceType t : values()) {
            if (t.name().equalsIgnoreCase(name)) {
                return t;
            }
        }
        throw new IllegalArgumentException("未知的产出方式: " + name);
    }
}
