package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

/**
 * 逻辑数据集
 * 是"同一份不断演进的数据"的身份标识，本身不含数据；具体数据落在 DatasetVersionEntity 上。
 * 注：与旧的 DatasetEntity(relational_system.dataset_meta) 并行存在，旧实体待迁移完成后移除。
 */
@Data
@Measurement(name = "relational_system.dataset")
public class DatasetInfoEntity {

    /** 即 createTime，用作数据集ID */
    @Field(timestamp = true)
    private Long id;

    @Field(name = "name")
    private String name;

    @Field(name = "description")
    private String description;

    @Field(name = "dataModality")
    private String dataModality;

    @Field(name = "project")
    private String project;

    @Field(name = "owner")
    private String owner;

    @Field(name = "createTime")
    private Long createTime;

    @Field(name = "operator")
    private String operator;

    @Field(name = "clientIp")
    private String clientIp;

    @Field(name = "deleted")
    private boolean deleted;
}
