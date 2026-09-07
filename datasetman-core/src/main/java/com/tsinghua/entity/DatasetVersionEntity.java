package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

/**
 * 数据集版本 = 一份具体的物化数据
 * 右侧数据集树的叶子节点、血缘图谱的节点都对应这张表的一条记录。
 */
@Data
@Measurement(name = "relational_system.dataset_version")
public class DatasetVersionEntity {

    /** 即 createTime，用作版本ID */
    @Field(timestamp = true)
    private Long id;

    /** 所属逻辑数据集ID（DatasetInfoEntity.id） */
    @Field(name = "datasetId")
    private Long datasetId;

    /** 冗余数据集名，便于树展示与查询 */
    @Field(name = "datasetName")
    private String datasetName;

    /** 版本号，如 v_260820_101530 */
    @Field(name = "versionNo")
    private String versionNo;

    /** 产出方式：SOURCE / SELECT / SELECT_UDF / TRANSFORM_SQL，见 ProvenanceType */
    @Field(name = "provenanceType")
    private String provenanceType;

    /** 物化数据实际路径；SOURCE 时为源库表前缀（只读挂载），其余为 datasets.<name>.<versionNo> */
    @Field(name = "storagePath")
    private String storagePath;

    /** 上游版本ID列表（JSON数组）；首个为主上游（通常是本数据集上一版本） */
    @Field(name = "upstreamVersionIds")
    private String upstreamVersionIds;

    /** 变换配方（JSON）：{sqlSnippetId, udfNames, transformJobId, sourceId, tablePrefix ...} */
    @Field(name = "derivationConfig")
    private String derivationConfig;

    @Field(name = "schemaJson")
    private String schemaJson;

    @Field(name = "rowCount")
    private Long rowCount;

    @Field(name = "sizeBytes")
    private Long sizeBytes;

    @Field(name = "createTime")
    private Long createTime;

    @Field(name = "operator")
    private String operator;

    @Field(name = "clientIp")
    private String clientIp;

    @Field(name = "remark")
    private String remark;

    @Field(name = "deleted")
    private boolean deleted;
}
