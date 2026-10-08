package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

/**
 * 血缘路径重跑（分叉）运行记录：一次「选择路径并重跑」的编排进度与结果。
 * stepsJson 为步骤数组：[{originVersionId, datasetName, provenanceType, newVersionId, newVersionNo, status, message}]
 */
@Data
@Measurement(name = "relational_system.lineage_fork_run")
public class LineageForkRunEntity {

    @Field(timestamp = true)
    private Long id;

    /** RUNNING / SUCCESS / FAILED */
    @Field(name = "status")
    private String status;

    @Field(name = "operator")
    private String operator;

    @Field(name = "clientIp")
    private String clientIp;

    @Field(name = "totalSteps")
    private Integer totalSteps;

    /** 当前执行到的步骤下标（0-based，-1 表示未开始） */
    @Field(name = "currentStepIndex")
    private Integer currentStepIndex;

    @Field(name = "stepsJson")
    private String stepsJson;

    /** 整体消息：失败原因或成功说明 */
    @Field(name = "message")
    private String message;

    @Field(name = "createTime")
    private Long createTime;
}
