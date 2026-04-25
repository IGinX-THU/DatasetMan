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
    private String dataset;
    private String pyTaskName;
}
