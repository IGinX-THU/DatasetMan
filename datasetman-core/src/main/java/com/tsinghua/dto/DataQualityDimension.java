package com.tsinghua.dto;

import lombok.Data;

@Data
public class DataQualityDimension {

    private Double weight;

    private String transformId;

    private String jobId;

    private String name;

    private String exportFile;

    private Double score;
}
