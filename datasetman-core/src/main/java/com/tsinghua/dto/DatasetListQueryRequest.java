package com.tsinghua.dto;

import lombok.Data;

/**
 * 数据集管理列表分页查询请求（含已禁用版本，不因状态过滤）。
 */
@Data
public class DatasetListQueryRequest {
    private Integer pageNum = 1;
    private Integer pageSize = 15;
    /** 数据集名称模糊匹配 */
    private String datasetName;
    /** 数据类型精确匹配（relational/time-series/...） */
    private String dataModality;

    /** 产出方式精确匹配（SOURCE/IMPORT/SQL_QUERY/TRANSFORM） */
    private String provenanceType;
}
