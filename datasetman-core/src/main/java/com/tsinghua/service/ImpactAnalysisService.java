package com.tsinghua.service;

import com.tsinghua.dto.ImpactAnalysisDTO;
import com.tsinghua.entity.DatasetLineageEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.enums.ProvenanceType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 影响范围分析：沿血缘向下游遍历，回答"这个版本变更/删除会影响哪些数据集"。
 */
@Slf4j
@Service
public class ImpactAnalysisService {

    @Autowired
    private DatasetVersionService datasetVersionService;

    public ImpactAnalysisDTO analyze(Long versionId) {
        ImpactAnalysisDTO result = new ImpactAnalysisDTO();
        result.setFocusVersionId(versionId);

        DatasetVersionEntity focus = datasetVersionService.queryVersion(versionId);
        if (focus == null) {
            throw new RuntimeException("版本不存在: " + versionId);
        }
        result.setDatasetName(focus.getDatasetName());
        result.setVersionNo(focus.getVersionNo());

        // 邻接表：fromVersionId -> 下游边
        Map<Long, List<DatasetLineageEntity>> byFrom = new HashMap<>();
        for (DatasetLineageEntity e : datasetVersionService.listAllEdges()) {
            if (e.getFromVersionId() != null) {
                byFrom.computeIfAbsent(e.getFromVersionId(), k -> new ArrayList<>()).add(e);
            }
        }

        // BFS 向下游遍历，记录深度与路径
        Deque<long[]> queue = new ArrayDeque<>();  // [版本ID, 深度]
        Map<Long, String> paths = new HashMap<>();
        queue.add(new long[]{versionId, 0});
        paths.put(versionId, focus.getVersionNo());

        while (!queue.isEmpty()) {
            long[] cur = queue.poll();
            long curId = cur[0];
            int depth = (int) cur[1];
            for (DatasetLineageEntity e : byFrom.getOrDefault(curId, Collections.emptyList())) {
                Long next = e.getToVersionId();
                if (next == null || paths.containsKey(next)) continue;
                DatasetVersionEntity v = datasetVersionService.queryVersion(next);
                if (v == null || v.isDeleted()) continue;

                String path = paths.get(curId) + " -> " + v.getVersionNo();
                paths.put(next, path);

                ImpactAnalysisDTO.ImpactedVersion iv = new ImpactAnalysisDTO.ImpactedVersion();
                iv.setVersionId(v.getId() != null ? v.getId() : v.getCreateTime());
                iv.setDatasetName(v.getDatasetName());
                iv.setVersionNo(v.getVersionNo());
                iv.setProvenanceType(v.getProvenanceType());
                iv.setProvenanceLabel(label(v.getProvenanceType()));
                iv.setJobState(v.getJobState());
                iv.setRowCount(v.getRowCount());
                iv.setOperator(v.getOperator());
                iv.setCreateTime(v.getCreateTime());
                iv.setDepth(depth + 1);
                iv.setPath(path);
                result.getImpactedVersions().add(iv);
                result.getImpactedDatasets().add(v.getDatasetName());
                result.setMaxDepth(Math.max(result.getMaxDepth(), depth + 1));
                result.setImpactedRowCount(result.getImpactedRowCount()
                        + (v.getRowCount() == null ? 0 : v.getRowCount()));

                queue.add(new long[]{next, depth + 1});
            }
        }
        return result;
    }

    private static String label(String provenanceType) {
        try {
            return ProvenanceType.of(provenanceType).getLabel();
        } catch (Exception e) {
            return provenanceType;
        }
    }
}
