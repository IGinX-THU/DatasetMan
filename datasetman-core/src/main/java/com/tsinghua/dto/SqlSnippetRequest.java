package com.tsinghua.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import java.util.List;

/**
 * SQL片段创建/编辑请求
 */
@Data
public class SqlSnippetRequest {

    @ApiModelProperty(value = "SQL片段名称", required = true)
    @NotBlank(message = "SQL片段名称不能为空")
    private String name;

    @ApiModelProperty(value = "SQL列表", required = true)
    @NotEmpty(message = "SQL列表不能为空")
    private List<String> sqlList;

    @ApiModelProperty(value = "描述信息")
    private String description;

    @ApiModelProperty(value = "编辑时传入原id，新建不传")
    private Long id;
}
