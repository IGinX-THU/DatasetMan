package com.tsinghua.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;

/**
 * 登记一个数据集版本（供各"生产者"调用：数据源注册 / SQL变换 / Transform作业）
 * 注意：本请求只负责登记元数据 + 写血缘，不负责物化数据；物化由调用方在登记前完成。
 */
@Data
public class DatasetVersionRegisterRequest {

    @ApiModelProperty(value = "数据集名称；不存在则自动创建逻辑数据集", required = true)
    @NotBlank(message = "数据集名称不能为空")
    private String datasetName;

    @ApiModelProperty(value = "产出方式：SOURCE / SELECT / SELECT_UDF / TRANSFORM_SQL", required = true)
    @NotBlank(message = "产出方式不能为空")
    private String provenanceType;

    @ApiModelProperty(value = "物化数据路径；SOURCE 时为源库表前缀", required = true)
    @NotBlank(message = "存储路径不能为空")
    private String storagePath;

    @ApiModelProperty(value = "上游版本ID列表；首个为主上游")
    private List<Long> upstreamVersionIds;

    @ApiModelProperty(value = "变换配方：sqlSnippetId / udfNames / transformJobId / sourceId / tablePrefix 等")
    private Map<String, Object> derivationConfig;

    @ApiModelProperty(value = "结构信息（JSON）")
    private String schemaJson;

    @ApiModelProperty(value = "行数")
    private Long rowCount;

    @ApiModelProperty(value = "字节大小")
    private Long sizeBytes;

    @ApiModelProperty(value = "备注")
    private String remark;

    @ApiModelProperty(value = "所属项目（仅在新建逻辑数据集时生效）")
    private String project;

    @ApiModelProperty(value = "数据集描述（仅在新建逻辑数据集时生效）")
    private String description;

    @ApiModelProperty(value = "数据模态：relational / time_series / key_value / semi_structured / file_system")
    private String dataModality;
}
