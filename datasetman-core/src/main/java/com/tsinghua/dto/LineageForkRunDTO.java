package com.tsinghua.dto;

import lombok.Data;

import java.util.List;

/**
 * 血缘路径重跑运行状态（前端轮询用）。
 */
@Data
public class LineageForkRunDTO {

    private Long runId;

    /** RUNNING / SUCCESS / FAILED */
    private String status;

    private String operator;

    private Integer totalSteps;

    private Integer currentStepIndex;

    private String message;

    private List<Step> steps;

    @Data
    public static class Step {
        private Long originVersionId;
        private String datasetName;
        private String originVersionNo;
        private String provenanceType;
        private Long newVersionId;
        private String newVersionNo;
        /** PENDING / RUNNING / SUCCESS / FAILED */
        private String status;
        private String message;
    }
}
