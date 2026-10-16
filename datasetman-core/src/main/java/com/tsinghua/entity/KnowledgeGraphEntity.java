package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

/**
 * 知识图谱实体
 * 记录neo4j知识图谱元信息：图谱名称、描述、节点/关系数据路径（knowledge_graphs.<图谱名称>.nodes/.edges）等。
 */
@Data
@Measurement(name = "relational_system.knowledge_graphs")
public class KnowledgeGraphEntity {

    @Field(timestamp = true)
    private Long id;

    @Field(name = "name")
    private String name;

    @Field(name = "description")
    private String description;

    /**
     * 节点数据路径（knowledge_graphs.<图谱名称>.nodes）
     */
    @Field(name = "nodePath")
    private String nodePath;

    /**
     * 关系数据路径（knowledge_graphs.<图谱名称>.edges）
     */
    @Field(name = "edgePath")
    private String edgePath;

    /**
     * 节点数量
     */
    @Field(name = "nodeCount")
    private Long nodeCount;

    /**
     * 关系数量
     */
    @Field(name = "edgeCount")
    private Long edgeCount;

    /**
     * 节点CSV列信息（JSON：columns/idColumn/labelColumn）
     */
    @Field(name = "nodeColumns")
    private String nodeColumns;

    /**
     * 关系CSV列信息（JSON：columns/sourceColumn/targetColumn/typeColumn）
     */
    @Field(name = "edgeColumns")
    private String edgeColumns;

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
