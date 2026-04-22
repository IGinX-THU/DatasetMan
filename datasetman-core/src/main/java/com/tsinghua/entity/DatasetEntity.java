package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

@Data
@Measurement(name = "relational_system.datasets")
public class DatasetEntity {

    @Field(timestamp = true)
    private Long key;

    @Field(name = "datasetName")
    private String datasetName;

    @Field(name = "datasetSql")
    private String datasetSql;

    @Field(name = "version")
    private String version;

    @Field(name = "createTime")
    private Long createTime;

    @Field(name = "parent")
    private long parent;

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
