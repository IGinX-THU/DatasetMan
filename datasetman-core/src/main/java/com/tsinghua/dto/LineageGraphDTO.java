package com.tsinghua.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 血缘图谱：节点 = 数据集版本，边 = 派生关系
 */
@Data
public class LineageGraphDTO {

    private List<Node> nodes = new ArrayList<>();
    private List<Edge> edges = new ArrayList<>();
    /** 当前聚焦的版本ID */
    private Long focusVersionId;
    /** 因 depth/maxNodes 限制被截断时为 true，前端可提示并提供逐层展开 */
    private boolean truncated;
    /** 当前用户可见的版本总数（供前端判断全量规模，-1 表示未统计） */
    private long visibleVersions = -1;

    @Data
    public static class Node {
        private Long versionId;
        private String datasetName;
        private String versionNo;
        private String provenanceType;
        private String provenanceLabel;
        private String storagePath;
        private String operator;
        private String clientIp;
        private Long createTime;
        private String remark;
        private boolean deleted;
        private Integer jobState;
        /** 是否为聚焦节点 */
        private boolean focus;
        /** 变换配方（JSON）：含 sqlSnippet / transformCompare / dataArchive 等快照 */
        private Map<String, Object> derivationConfig;
        /** 全图中该版本的直接上游边数（不受 depth/maxNodes 截断影响，-1 表示未统计） */
        private long upstreamCount = -1;
        /** 全图中该版本的直接下游边数（不受 depth/maxNodes 截断影响，-1 表示未统计） */
        private long downstreamCount = -1;
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
