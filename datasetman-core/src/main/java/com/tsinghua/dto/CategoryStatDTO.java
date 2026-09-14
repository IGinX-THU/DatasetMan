package com.tsinghua.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 数据集分类统计：按数据类型（relational/time_series/key_value/semi_structured/file_system 等）。
 */
@Data
public class CategoryStatDTO {

    /** 数据类型编码，如 relational */
    private String code;

    /** 中文名，如 关系型 */
    private String label;

    /** 说明 */
    private String description;

    /** 数据集（逻辑）数量 */
    private int datasetCount;

    /** 未删除版本数量 */
    private int versionCount;

    /** 样本量合计（rowCount 求和） */
    private long totalRowCount;

    /** 该类型下的数据集名称列表 */
    private List<String> datasetNames = new ArrayList<>();
}
