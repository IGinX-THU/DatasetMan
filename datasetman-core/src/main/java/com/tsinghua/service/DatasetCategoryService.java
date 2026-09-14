package com.tsinghua.service;

import com.tsinghua.dto.CategoryStatDTO;
import com.tsinghua.dto.DatasetRelationDTO;
import com.tsinghua.entity.DatasetVersionEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 数据集分类管理与关系提取：
 * 1. 按数据类型（relational/time_series/key_value/semi_structured/file_system 等）分类统计与检索；
 * 2. 从血缘、共享上游、相同数据类型中自动提取数据集间关系。
 */
@Slf4j
@Service
public class DatasetCategoryService {

    /** 平台支持的数据类型及中文名 */
    private static final LinkedHashMap<String, String> MODALITIES = new LinkedHashMap<>();
    static {
        MODALITIES.put("relational", "关系型");
        MODALITIES.put("time_series", "时序数据");
        MODALITIES.put("key_value", "键值");
        MODALITIES.put("semi_structured", "半结构化/文档");
        MODALITIES.put("file_system", "文件系统");
        MODALITIES.put("text", "文本");
        MODALITIES.put("image", "图像");
        MODALITIES.put("audio", "音频");
        MODALITIES.put("video", "视频");
    }

    public static String modalityLabel(String code) {
        return MODALITIES.getOrDefault(code, code);
    }

    @Autowired
    private DatasetVersionService datasetVersionService;

    /** 按数据类型的分类统计数据 */
    public List<CategoryStatDTO> categoryStats() {
        List<DatasetVersionEntity> versions = datasetVersionService.listAllAccessibleVersions();

        Map<String, List<DatasetVersionEntity>> byType = new LinkedHashMap<>();
        for (DatasetVersionEntity v : versions) {
            String type = v.getDataModality() == null || v.getDataModality().isEmpty()
                    ? "unclassified" : v.getDataModality();
            byType.computeIfAbsent(type, k -> new ArrayList<>()).add(v);
        }

        List<CategoryStatDTO> stats = new ArrayList<>();
        for (Map.Entry<String, List<DatasetVersionEntity>> entry : byType.entrySet()) {
            String code = entry.getKey();
            List<DatasetVersionEntity> list = entry.getValue();
            CategoryStatDTO stat = new CategoryStatDTO();
            stat.setCode(code);
            stat.setLabel("unclassified".equals(code) ? "未分类" : modalityLabel(code));
            stat.setDescription("数据类型: " + code);
            stat.setVersionCount(list.size());
            stat.setDatasetCount((int) list.stream().map(DatasetVersionEntity::getDatasetName).distinct().count());
            stat.setTotalRowCount(list.stream()
                    .mapToLong(v -> v.getRowCount() == null ? 0 : v.getRowCount()).sum());
            stat.setDatasetNames(list.stream()
                    .map(DatasetVersionEntity::getDatasetName).distinct().sorted().collect(Collectors.toList()));
            stats.add(stat);
        }
        return stats;
    }

    /** 某数据类型下的数据集（逻辑数据集聚合到最新版本），参数兼容中文类型名 */
    public List<DatasetVersionEntity> datasetsByCategory(String type) {
        String code = MODALITIES.containsKey(type) ? type
                : MODALITIES.entrySet().stream()
                        .filter(e -> e.getValue().equals(type))
                        .map(Map.Entry::getKey).findFirst().orElse(type);
        Map<String, DatasetVersionEntity> latestByName = new LinkedHashMap<>();
        datasetVersionService.listAllAccessibleVersions().stream()
                .filter(v -> code.equals(v.getDataModality()))
                .forEach(v -> latestByName.merge(v.getDatasetName(), v,
                        (a, b) -> a.getCreateTime() >= b.getCreateTime() ? a : b));
        return latestByName.values().stream()
                .sorted(Comparator.comparing(DatasetVersionEntity::getDatasetName))
                .collect(Collectors.toList());
    }

    /**
     * 关系提取（按逻辑数据集粒度）：
     * - derived_from：血缘边中跨数据集的派生关系；
     * - same_source：两个数据集共享同一上游数据集；
     * - same_type：相同数据类型下的数据集关联。
     *
     * @param datasetName 可选，聚焦某个数据集的关系；为空则返回全部
     */
    public List<DatasetRelationDTO> extractRelations(String datasetName) {
        List<DatasetVersionEntity> versions = datasetVersionService.listAllAccessibleVersions();
        Map<Long, DatasetVersionEntity> versionById = versions.stream()
                .filter(v -> v.getId() != null)
                .collect(Collectors.toMap(DatasetVersionEntity::getId, v -> v, (a, b) -> a));

        Set<String> seen = new LinkedHashSet<>();
        List<DatasetRelationDTO> relations = new ArrayList<>();

        // 1. derived_from：血缘边中 from/to 属于不同逻辑数据集
        datasetVersionService.listAllEdges().forEach(e -> {
            DatasetVersionEntity from = versionById.get(e.getFromVersionId());
            DatasetVersionEntity to = versionById.get(e.getToVersionId());
            if (from != null && to != null && !from.getDatasetName().equals(to.getDatasetName())) {
                addIfMatch(relations, seen, from.getDatasetName(), to.getDatasetName(),
                        DatasetRelationDTO.DERIVED_FROM,
                        String.format("血缘边 %s(%s) -> %s(%s)", from.getVersionNo(),
                                e.getRelationType(), to.getVersionNo(), to.getDatasetName()),
                        datasetName);
            }
        });

        // 2. same_type：同一数据类型下的数据集两两关联
        Map<String, Set<String>> byType = new LinkedHashMap<>();
        for (DatasetVersionEntity v : versions) {
            if (v.getDataModality() == null || v.getDataModality().isEmpty()) continue;
            byType.computeIfAbsent(v.getDataModality(), k -> new TreeSet<>()).add(v.getDatasetName());
        }
        byType.forEach((type, names) -> {
            List<String> list = new ArrayList<>(names);
            for (int i = 0; i < list.size(); i++) {
                for (int j = i + 1; j < list.size(); j++) {
                    addIfMatch(relations, seen, list.get(i), list.get(j),
                            DatasetRelationDTO.SAME_TYPE, "同数据类型: " + modalityLabel(type), datasetName);
                }
            }
        });

        // 3. same_source：共享同一上游数据集
        Map<String, Set<String>> upstreamNameToDatasets = new LinkedHashMap<>();
        for (DatasetVersionEntity v : versions) {
            for (Long uid : datasetVersionService.parseUpstreamIds(v)) {
                DatasetVersionEntity up = versionById.get(uid);
                if (up != null && !up.getDatasetName().equals(v.getDatasetName())) {
                    upstreamNameToDatasets.computeIfAbsent(up.getDatasetName(), k -> new TreeSet<>()).add(v.getDatasetName());
                }
            }
        }
        upstreamNameToDatasets.forEach((upstream, names) -> {
            List<String> list = new ArrayList<>(names);
            for (int i = 0; i < list.size(); i++) {
                for (int j = i + 1; j < list.size(); j++) {
                    addIfMatch(relations, seen, list.get(i), list.get(j),
                            DatasetRelationDTO.SAME_SOURCE, "共同派生自: " + upstream, datasetName);
                }
            }
        });

        return relations;
    }

    private void addIfMatch(List<DatasetRelationDTO> relations, Set<String> seen,
                            String from, String to, String type, String evidence, String focus) {
        if (focus != null && !focus.isEmpty() && !focus.equals(from) && !focus.equals(to)) {
            return;
        }
        String key = type + "|" + from + "|" + to;
        if (seen.add(key)) {
            relations.add(DatasetRelationDTO.of(from, to, type, evidence));
        }
    }
}
