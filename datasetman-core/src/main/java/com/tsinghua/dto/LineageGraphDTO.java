package com.tsinghua.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 血缘图谱：节点 = 数据集版本，边 = 派生关系
 */
@Data
public class LineageGraphDTO {

    private List<Node> nodes = new ArrayList<>();
    private List<Edge> edges = new ArrayList<>();
    /** 当前聚焦的版本ID */
    private Long focusVersionId;

    @Data
    public static class Node {
        private Long versionId;
        private Long datasetId;
        private String datasetName;
        private String versionNo;
        private String provenanceType;
        private String provenanceLabel;
        private String storagePath;
        private String operator;
        private Long createTime;
        private String remark;
        private boolean deleted;
        /** 是否为聚焦节点 */
        private boolean focus;
    }

    @Data
    public static class Edge {
        private Long from;
        private Long to;
        private String relationType;
        /** 主上游（同数据集版本链，实线）/ 辅助引用（跨数据集，虚线） */
        private boolean primary;
    }
}
