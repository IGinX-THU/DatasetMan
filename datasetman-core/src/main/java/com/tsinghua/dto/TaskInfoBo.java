package com.tsinghua.dto;

import com.tsinghua.entity.DatasetEntity;
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
    private DatasetEntity dataset;
    private String pyTaskName;
}
