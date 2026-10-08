package com.tsinghua.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class DatasetCreateRequest {
    @NotBlank(message = "数据集名称不能为空")
    private String datasetName;
    @NotBlank(message = "产出方式不能为空")
    private String provenanceType; // SOURCE / SQL_QUERY / TRANSFORM

    // 1. SOURCE 对应参数
    private String sourcePath;

    // 1b. IMPORT 对应参数（CSV 文件上传）
    private String importFileName;  // 上传后的文件名
    private String importFileBase64; // Base64 编码的文件内容
    private String importKeyColumn;  // 指定 CSV 中的 key 列名（可选）

    // 2. SQL_QUERY 对应参数
    private Long sqlSnippetId;
    private List<Long> upstreamVersionIds;
    /** 路径重跑：SQL 物化时 ${upstream} 的绑定上游（缺省回退 upstreamVersionIds），与登记的上游列表解耦 */
    private List<Long> executionUpstreamVersionIds;
    /** 路径重跑：true 时新版本登记为无上游的独立根，不自动挂接同名最新版本 */
    private Boolean explicitRoot;
    private List<String> udfNames;
    /** SQL 语句与上游版本的绑定：{ upstreamVersionId(as String) -> [sqlIndex, ...] } */
    private java.util.Map<String, List<Integer>> upstreamSqlBindings;

    // 3. TRANSFORM 对应参数
    private Long transformCompareCreateTime;

    // 通用元数据
    private String description;
    private String dataModality;
    private String project;
    private String remark;
    private String category; // 场景分类编码，见 SceneCategoryEnum
    private String tags;

    /** 可选：前端规划的目标版本号（v_yymmdd_HHmmss），保证存储路径预览与实际创建一致 */
    private String versionNo;
}
