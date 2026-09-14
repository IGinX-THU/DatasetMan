package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

@Data
@Measurement(name = "relational_system.quality_assessment")
public class QualityAssessmentEntity {

    @Field(timestamp = true)
    private Long id;

    @Field(name = "criteriaId")
    private Long criteriaId;

    @Field(name = "criteriaName")
    private String criteriaName;

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

    @Field(name = "jobIds")
    private String jobIds;

    @Field(name = "scores")
    private String scores;

    @Field(name = "dqi")
    private String dqi;

    @Field(name = "passed")
    private String passed;

    @Field(name = "createTime")
    private Long createTime;

    @Field(name = "operator")
    private String operator;

    @Field(name = "clientIp")
    private String clientIp;

    @Field(name = "owner")
    private String owner;

    /** 自动生成的评估报告（JSON）：四维得分、DQI、问题明细与整改建议 */
    @Field(name = "reportJson")
    private String reportJson;

    /** 自动检测明细（JSON）：抽样规模、空值/重复/越界计数、数据年龄等 */
    @Field(name = "detailJson")
    private String detailJson;
}
