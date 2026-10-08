package com.tsinghua.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

/**
 * 血缘路径重跑请求：从 forkVersionId 起沿下游依次经过 pathVersionIds 的链路，
 * 每个数据集生成同名新版本，形成独立的新版本树。
 */
@Data
public class LineageForkRequest {

    /** 分叉起始版本ID（须为 SOURCE 或 SQL_QUERY） */
    @NotNull(message = "分叉起始版本不能为空")
    private Long forkVersionId;

    /** 完整路径的版本ID有序列表（含 forkVersionId 在首位；相邻版本间必须存在血缘边） */
    @NotNull(message = "重跑路径不能为空")
    private List<Long> pathVersionIds;

    /** 可选：每个版本重跑时编辑后的 SQL 语句列表（key=原版本ID），未提供的步骤沿用原 SQL（含表名替换） */
    private Map<Long, List<String>> stepEdits;
}
