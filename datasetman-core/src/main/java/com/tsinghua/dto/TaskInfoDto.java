package com.tsinghua.dto;

import lombok.Data;

@Data
public class TaskInfoDto {
    /**
     *  IGINX(0),
     *  PYTHON(1);
     */
    private int taskType;
    /**
     *    BATCH(0),
     *   STREAM(1);
     */
    private int dataFlowType;
    private Long timeout;
    /**
     * 旧字段：通过数据集storagePath引用SQL（兼容保留，新数据请用sqlSnippetId）
     */
    private String dataset;
    /**
     * 新字段：通过SQL脚本id引用SQL列表（推荐）
     */
    private Long sqlSnippetId;
    /**
     * SQL脚本名称（保存时一并存入，便于展示）
     */
    private String sqlSnippetName;
    private String pyTaskName;
}
