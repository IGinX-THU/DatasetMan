package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

@Data
@Measurement(name = "relational_system.transform_compare")
public class TransformCompareEntity {

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
