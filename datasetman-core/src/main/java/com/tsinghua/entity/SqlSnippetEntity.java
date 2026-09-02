package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

/**
 * SQL片段实体
 * 独立管理的可复用SQL列表资源，供transform编排和数据集版本生产引用。
 * 对标函数管理，是命名、可执行、可复用的资源。
 */
@Data
@Measurement(name = "relational_system.sql_snippet")
public class SqlSnippetEntity {

    @Field(timestamp = true)
    private Long id;

    @Field(name = "name")
    private String name;

    /**
     * SQL列表（JSON数组字符串）
     */
    @Field(name = "sqlList")
    private String sqlList;

    @Field(name = "description")
    private String description;

    @Field(name = "owner")
    private String owner;

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

    /**
     * 逻辑删除
     */
    @Field(name = "deleted")
    private boolean deleted;
}
