package com.tsinghua.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 影响范围分析结果：某版本变更/删除时受影响的下游数据集、版本链与规模统计。
 */
@Data
public class ImpactAnalysisDTO {

    private Long focusVersionId;
    private String datasetName;
    private String versionNo;

    /** 受影响（下游）版本，按级联层次排列 */
    private Set<ImpactedVersion> impactedVersions = new LinkedHashSet<>();

    /** 受影响的逻辑数据集名列表（去重） */
    private Set<String> impactedDatasets = new LinkedHashSet<>();

    /** 最大级联深度 */
    private int maxDepth;

    /** 下游样本量合计 */
    private long impactedRowCount;

    @Data
    public static class ImpactedVersion {
        private Long versionId;
        private String datasetName;
        private String versionNo;
        private String provenanceType;
        private String provenanceLabel;
        private Integer jobState;
        private Long rowCount;
        private String operator;
        private Long createTime;
        /** 距焦点的级联深度（1=直接下游） */
        private int depth;
        /** 到焦点的路径，如 v1 -> v2 -> v3 */
        private String path;
    }
}
