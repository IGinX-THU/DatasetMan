package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

@Data
@Measurement(name = "relational_system.transform_job")
public class TransformJobEntity {

    @Field(timestamp = true)
    private Long id;

    @Field(name = "name")
    private String name;

    @Field(name = "taskList")
    private String taskList;

    @Field(name = "exportFiletName")
    private String exportFiletName;

    @Field(name = "schedule")
    private String schedule;

    @Field(name = "jobId")
    private Long jobId;

    /**
     * JOB_UNKNOWN(0) 作业状态未知
     * JOB_FINISHED(1) 作业完成（有设置重复调度时，表示所有调度完成）
     * JOB_CREATED(2) 作业创建
     * JOB_IDLE(3) 作业等待运行（有调度时）
     * JOB_RUNNING(4) 作业运行中
     * JOB_FAILING(5) 作业失败中（正在释放资源）
     * JOB_FAILED(6) 作业失败
     * JOB_CLOSING(7) 作业取消中（正在释放资源）
     * JOB_CLOSED(8) 作业取消
     */
    @Field(name = "JobState")
    private int JobState;

    @Field(name = "createTime")
    private Long createTime;

    /**
     * 操作人
     */
    @Field(name = "operator")
    private String operator;

    /**
     * 操作人IP地址
     */
    @Field(name = "clientIp")
    private String clientIp;


}
