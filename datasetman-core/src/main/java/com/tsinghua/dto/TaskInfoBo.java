package com.tsinghua.dto;

import com.tsinghua.entity.DatasetEntity;
import com.tsinghua.entity.SqlSnippetEntity;
import lombok.Data;

@Data
public class TaskInfoBo {
    /**
     *  IGINX(0),
     *  PYTHON(1);
     */
    private String taskType;
    /**
     *    BATCH(0),
     *   STREAM(1);
     */
    private String dataFlowType;
    private Long timeout;
    /**
     * 旧字段：通过数据集引用SQL（兼容保留）
     */
    private DatasetEntity dataset;
    /**
     * 新字段：通过SQL片段引用SQL列表（推荐）
     */
    private SqlSnippetEntity sqlSnippet;
    private String pyTaskName;
}
