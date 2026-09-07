package com.tsinghua.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.util.List;

@Data
public class DatasetCreateRequest {
    @NotBlank(message = "数据集名称不能为空")
    private String datasetName;
    @NotBlank(message = "产出方式不能为空")
    private String provenanceType;
    private String sourcePath;
    private List<Long> upstreamVersionIds;
    private Long sqlSnippetId;
    private List<String> udfNames;
    private String transformJobId;
    private String transformOutputPath;
    private String description;
    private String dataModality;
    private String project;
    private String remark;
}
