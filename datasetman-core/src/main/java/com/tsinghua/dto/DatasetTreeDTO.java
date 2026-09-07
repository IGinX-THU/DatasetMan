package com.tsinghua.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 右侧数据集树：数据集名称 -> 版本。
 */
@Data
public class DatasetTreeDTO {
    private Long datasetId;
    private String datasetName;
    private List<Version> versions = new ArrayList<>();

    @Data
    public static class Version {
        private Long versionId;
        private String versionNo;
        private String storagePath;
        private String provenanceType;
        private Long createTime;
        private boolean deleted;
    }
}
