package com.tsinghua.service;

import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.dto.DatasetChangeProcessDTO;
import com.tsinghua.dto.LineageGraphDTO;
import com.tsinghua.entity.DatasetLineageEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.enums.ProvenanceType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 血缘服务：提供关系图谱与变化过程表格数据，二者节点一一对应。
 */
@Slf4j
@Service
public class LineageService {

    @Autowired
    private DatasetVersionService datasetVersionService;

    /**
     * 以某个版本为中心，向上追溯全部上游、向下展开全部下游，构成图谱。
     *
     * @param versionId   聚焦版本
     * @param sideLineage 是否包含旁系血缘（跨数据集的辅助引用边）；false 时只保留主上游链
     */
    public LineageGraphDTO getLineageGraph(Long versionId, boolean sideLineage) {
        LineageGraphDTO graph = new LineageGraphDTO();
        graph.setFocusVersionId(versionId);

        DatasetVersionEntity focus = datasetVersionService.queryVersion(versionId);
        if (focus == null) {
            return graph;
        }

        List<DatasetLineageEntity> allEdges = datasetVersionService.listAllEdges().stream()
                .filter(e -> sideLineage || e.isPrimary())
                .collect(Collectors.toList());

        Map<Long, List<DatasetLineageEntity>> byFrom = allEdges.stream()
                .collect(Collectors.groupingBy(DatasetLineageEntity::getFromVersionId));
        Map<Long, List<DatasetLineageEntity>> byTo = allEdges.stream()
                .collect(Collectors.groupingBy(DatasetLineageEntity::getToVersionId));

        // BFS 双向遍历，收集连通的版本与边
        Set<Long> visited = new LinkedHashSet<>();
        Set<DatasetLineageEntity> edges = new LinkedHashSet<>();
        Deque<Long> queue = new ArrayDeque<>();
        queue.add(versionId);
        visited.add(versionId);
        while (!queue.isEmpty()) {
            Long cur = queue.poll();
            for (DatasetLineageEntity e : byTo.getOrDefault(cur, Collections.emptyList())) {
                edges.add(e);
                if (visited.add(e.getFromVersionId())) queue.add(e.getFromVersionId());
            }
            for (DatasetLineageEntity e : byFrom.getOrDefault(cur, Collections.emptyList())) {
                edges.add(e);
                if (visited.add(e.getToVersionId())) queue.add(e.getToVersionId());
            }
        }

        for (Long id : visited) {
            DatasetVersionEntity v = datasetVersionService.queryVersion(id);
            if (v != null) {
                graph.getNodes().add(toNode(v, id.equals(versionId)));
            }
        }
        for (DatasetLineageEntity e : edges) {
            LineageGraphDTO.Edge edge = new LineageGraphDTO.Edge();
            edge.setFrom(e.getFromVersionId());
            edge.setTo(e.getToVersionId());
            edge.setRelationType(e.getRelationType());
            edge.setPrimary(e.isPrimary());
            graph.getEdges().add(edge);
        }
        return graph;
    }

    /**
     * 某个逻辑数据集的变化过程表格：每一行是一个版本，含上游引用与变换配方。
     */
    public List<DatasetChangeProcessDTO> getChangeProcess(Long datasetId) {
        List<DatasetVersionEntity> versions = datasetVersionService.listVersions(datasetId, true);
        Map<Long, DatasetVersionEntity> cache = new HashMap<>();
        versions.forEach(v -> cache.put(v.getId(), v));

        List<DatasetChangeProcessDTO> rows = new ArrayList<>();
        for (DatasetVersionEntity v : versions) {
            DatasetChangeProcessDTO row = new DatasetChangeProcessDTO();
            row.setVersionId(v.getId());
            row.setVersionNo(v.getVersionNo());
            row.setProvenanceType(v.getProvenanceType());
            row.setProvenanceLabel(label(v.getProvenanceType()));
            row.setStoragePath(v.getStoragePath());
            row.setOperator(v.getOperator());
            row.setClientIp(v.getClientIp());
            row.setCreateTime(v.getCreateTime());
            row.setRemark(v.getRemark());
            row.setRowCount(v.getRowCount());
            row.setSizeBytes(v.getSizeBytes());
            row.setDeleted(v.isDeleted());
            row.setDerivationConfig(parseConfig(v.getDerivationConfig()));

            List<Long> upstreamIds = datasetVersionService.parseUpstreamIds(v);
            List<DatasetChangeProcessDTO.UpstreamRef> refs = new ArrayList<>();
            for (int i = 0; i < upstreamIds.size(); i++) {
                Long uid = upstreamIds.get(i);
                DatasetVersionEntity up = cache.computeIfAbsent(uid, datasetVersionService::queryVersion);
                DatasetChangeProcessDTO.UpstreamRef ref = new DatasetChangeProcessDTO.UpstreamRef();
                ref.setVersionId(uid);
                ref.setPrimary(i == 0);
                if (up != null) {
                    ref.setDatasetName(up.getDatasetName());
                    ref.setVersionNo(up.getVersionNo());
                }
                refs.add(ref);
            }
            row.setUpstreams(refs);
            rows.add(row);
        }
        return rows;
    }

    private LineageGraphDTO.Node toNode(DatasetVersionEntity v, boolean focus) {
        LineageGraphDTO.Node node = new LineageGraphDTO.Node();
        node.setVersionId(v.getId());
        node.setDatasetId(v.getDatasetId());
        node.setDatasetName(v.getDatasetName());
        node.setVersionNo(v.getVersionNo());
        node.setProvenanceType(v.getProvenanceType());
        node.setProvenanceLabel(label(v.getProvenanceType()));
        node.setStoragePath(v.getStoragePath());
        node.setOperator(v.getOperator());
        node.setCreateTime(v.getCreateTime());
        node.setRemark(v.getRemark());
        node.setDeleted(v.isDeleted());
        node.setFocus(focus);
        return node;
    }

    private static String label(String provenanceType) {
        try {
            return ProvenanceType.of(provenanceType).getLabel();
        } catch (Exception e) {
            return provenanceType;
        }
    }

    private static Map<String, Object> parseConfig(String json) {
        if (json == null || json.isEmpty()) {
            return Collections.emptyMap();
        }
        try {
            return JSONObject.parseObject(json);
        } catch (Exception e) {
            return Collections.singletonMap("raw", json);
        }
    }
}
