package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import lombok.Data;

/**
 * 数据集血缘边：fromVersion -> toVersion
 * 权威血缘来源是 DatasetVersionEntity.upstreamVersionIds，本表是冗余边表，用于加速图谱查询/反查下游。
 */
@Data
@Measurement(name = "relational_system.dataset_lineage")
public class DatasetLineageEntity {

    @Field(timestamp = true)
    private Long id;

    /** 上游版本ID */
    @Field(name = "fromVersionId")
    private Long fromVersionId;

    /** 下游版本ID */
    @Field(name = "toVersionId")
    private Long toVersionId;

    /** 关系类型：source / select / udf / transform，见 ProvenanceType.relationType */
    @Field(name = "relationType")
    private String relationType;

    /** 是否主上游（同数据集版本链，实线）；false 为跨数据集辅助引用（虚线） */
    @Field(name = "primary")
    private boolean primary;

    @Field(name = "createTime")
    private Long createTime;
}
