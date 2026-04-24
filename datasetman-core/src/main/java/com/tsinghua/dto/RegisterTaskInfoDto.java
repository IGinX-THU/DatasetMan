package com.tsinghua.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterTaskInfoDto {
    @ApiModelProperty(value = "函数名称")
    private String name;
    @ApiModelProperty(value = "脚本类名")
    private String className;
    @ApiModelProperty(value = "脚本文件名")
    private String fileName;
    @ApiModelProperty(value = "IGinX节点")
    private String ipPortPair;
    @ApiModelProperty(value = "函数类型")
    private String type;
}
