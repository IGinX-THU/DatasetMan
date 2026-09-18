package com.tsinghua.dto;

import lombok.Data;

@Data
public class DatasetPathPreviewDTO {
    private String datasetName;
    private String provenanceType;
    private String versionNo;
    private String storagePath;
}
