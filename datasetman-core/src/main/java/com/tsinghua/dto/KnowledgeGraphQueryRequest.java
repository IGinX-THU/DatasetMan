package com.tsinghua.dto;

import lombok.Data;

/**
 * 知识图谱分页查询请求
 */
@Data
public class KnowledgeGraphQueryRequest {

    private Integer pageNum = 1;

    private Integer pageSize = 100;

    /**
     * 图谱名称（模糊查询，可为空）
     */
    private String name;
}
