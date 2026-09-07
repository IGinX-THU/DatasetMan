package com.tsinghua.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.util.List;

@Data
public class DatasetCreateRequest {
    @NotBlank(message = "数据集名称不能为空")
    private String datasetName;
    @NotBlank(message = "产出方式不能为空")
    private String provenanceType; // SOURCE / SQL_QUERY / TRANSFORM

    // 1. SOURCE 对应参数
    private String sourcePath;

    // 2. SQL_QUERY 对应参数
    private Long sqlSnippetId;
    private List<Long> upstreamVersionIds;
    private List<String> udfNames;

    // 3. TRANSFORM 对应参数
    private Long transformCompareCreateTime;

    // 通用元数据
    private String description;
    private String dataModality;
    private String project;
    private String remark;
}
