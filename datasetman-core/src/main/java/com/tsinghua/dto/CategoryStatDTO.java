package com.tsinghua.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 场景分类统计：11类智能体研发场景的数据集覆盖情况。
 */
@Data
public class CategoryStatDTO {

    private String code;
    private String label;
    private String stage;
    private String description;

    /** 数据集（逻辑）数量 */
    private int datasetCount;

    /** 未删除版本数量 */
    private int versionCount;

    /** 样本量合计（rowCount 求和） */
    private long totalRowCount;

    /** 该场景下的数据集名称列表 */
    private List<String> datasetNames = new ArrayList<>();
}
