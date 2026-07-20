package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

@Data
@Measurement(name = "relational_system.evaluation_criteria")
public class EvaluationCriteriaEntity {

    @Field(timestamp = true)
    private Long id;

    @Field(name = "name")
    private String name;

    @Field(name = "description")
    private String description;

    @Field(name = "weights")
    private String weights;

    @Field(name = "jobs")
    private String jobs;

    @Field(name = "exportFiles")
    private String exportFiles;

    @Field(name = "names")
    private String names;

    @Field(name = "createTime")
    private Long createTime;

    @Field(name = "operator")
    private String operator;

    @Field(name = "clientIp")
    private String clientIp;

    @Field(name = "owner")
    private String owner;
}
