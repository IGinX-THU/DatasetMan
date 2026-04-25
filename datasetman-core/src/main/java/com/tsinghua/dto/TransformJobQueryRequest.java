package com.tsinghua.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("Transform作业查询请求")
public class TransformJobQueryRequest {
    
    @ApiModelProperty(value = "页码", example = "1")
    private Integer pageNum;
    
    @ApiModelProperty(value = "每页大小", example = "6")
    private Integer pageSize;
    
    @ApiModelProperty(value = "作业名称（模糊查询）", example = "作业名称")
    private String name;
    
    @ApiModelProperty(value = "作业状态", example = "2")
    private Integer jobState;
}
