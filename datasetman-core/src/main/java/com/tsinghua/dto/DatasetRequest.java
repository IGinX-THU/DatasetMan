package com.tsinghua.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class DatasetRequest {

    @ApiModelProperty(value = "数据集名称", required = true)
    @NotBlank(message = "数据集名称不能为空")
    private String datasetName;

    @ApiModelProperty(value = "数据集名称", required = true)
    @NotBlank(message = "数据集SQL不能为空")
    private String datasetSql;

    @ApiModelProperty(value = "上个版本")
    private long parent;

}
