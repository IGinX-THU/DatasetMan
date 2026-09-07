package com.tsinghua.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 数据集变化过程表格的一行（一个版本），与血缘图谱的一个节点一一对应
 */
@Data
public class DatasetChangeProcessDTO {
    private Long versionId;
    private String versionNo;
    private String provenanceType;
    private String provenanceLabel;
    private String storagePath;
    /** 上游版本（含跨数据集引用） */
    private List<UpstreamRef> upstreams;
    /** 变换配方（已解析的 JSON） */
    private Map<String, Object> derivationConfig;
    private String operator;
    private String clientIp;
    private Long createTime;
    private String remark;
    private Long rowCount;
    private Long sizeBytes;
    private boolean deleted;

    @Data
    public static class UpstreamRef {
        private Long versionId;
        private String datasetName;
        private String versionNo;
        private boolean primary;
    }
}
