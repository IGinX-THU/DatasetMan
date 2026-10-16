package com.tsinghua.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 知识图谱上传请求（对齐创建数据集的CSV导入模式：文件Base64随JSON上传）
 */
@Data
public class KnowledgeGraphUploadRequest {

    @ApiModelProperty(value = "图谱名称", required = true)
    @NotBlank(message = "图谱名称不能为空")
    private String name;

    @ApiModelProperty(value = "描述信息")
    private String description;

    @ApiModelProperty(value = "节点数据文件名", required = true)
    @NotBlank(message = "请上传节点数据文件")
    private String nodesFileName;

    @ApiModelProperty(value = "节点数据文件内容（Base64）", required = true)
    @NotBlank(message = "节点数据文件内容不能为空")
    private String nodesFileBase64;

    @ApiModelProperty(value = "关系数据文件名", required = true)
    @NotBlank(message = "请上传关系数据文件")
    private String edgesFileName;

    @ApiModelProperty(value = "关系数据文件内容（Base64）", required = true)
    @NotBlank(message = "关系数据文件内容不能为空")
    private String edgesFileBase64;
}
