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
     * @param sideLineage 是否包含旁系血缘：true 时显示同数据集名的所有独立版本树；false 时只显示当前版本连通的树
     */
    public LineageGraphDTO getLineageGraph(Long versionId, boolean sideLineage) {
        LineageGraphDTO graph = new LineageGraphDTO();
        graph.setFocusVersionId(versionId);

        DatasetVersionEntity focus = datasetVersionService.queryVersion(versionId);
        if (focus == null) {
            return graph;
        }

        // 1. 从血缘边表获取连通的边
        List<DatasetLineageEntity> allEdges = datasetVersionService.listAllEdges();

        Map<Long, List<DatasetLineageEntity>> byFrom = new HashMap<>();
        Map<Long, List<DatasetLineageEntity>> byTo = new HashMap<>();
        for (DatasetLineageEntity e : allEdges) {
            if (e.getFromVersionId() != null) byFrom.computeIfAbsent(e.getFromVersionId(), k -> new ArrayList<>()).add(e);
            if (e.getToVersionId() != null) byTo.computeIfAbsent(e.getToVersionId(), k -> new ArrayList<>()).add(e);
        }

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
                if (e.getFromVersionId() != null && visited.add(e.getFromVersionId())) queue.add(e.getFromVersionId());
            }
            for (DatasetLineageEntity e : byFrom.getOrDefault(cur, Collections.emptyList())) {
                edges.add(e);
                if (e.getToVersionId() != null && visited.add(e.getToVersionId())) queue.add(e.getToVersionId());
            }
        }

        // 2. 补充：从版本的 upstreamVersionIds 补全血缘边（兼容边表缺失或 IginX 读回异常的情况）
        //    新发现的上游会继续入队，递归向上追溯，避免只处理一层快照。
        while (!queue.isEmpty()) {
            Long id = queue.poll();
            DatasetVersionEntity v = datasetVersionService.queryVersion(id);
            if (v == null) continue;
            List<Long> upstreamIds = datasetVersionService.parseUpstreamIds(v);
            for (Long uid : upstreamIds) {
                if (uid == null) continue;
                boolean alreadyExists = edges.stream().anyMatch(e ->
                        uid.equals(e.getFromVersionId()) && id.equals(e.getToVersionId()));
                if (!alreadyExists) {
                    DatasetLineageEntity supplemental = new DatasetLineageEntity();
                    supplemental.setFromVersionId(uid);
                    supplemental.setToVersionId(id);
                    supplemental.setRelationType(label(v.getProvenanceType()));
                    supplemental.setPrimary(uid.equals(upstreamIds.get(0)));
                    edges.add(supplemental);
                }
                if (visited.add(uid)) queue.add(uid);
            }
        }

        // 3. 旁系血缘：把同数据集名的所有版本都加进来（含独立的版本树）
        if (sideLineage && focus.getDatasetName() != null) {
            for (DatasetVersionEntity v : datasetVersionService.listVersions(focus.getDatasetName(), true)) {
                if (v.getId() != null) visited.add(v.getId());
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
    public List<DatasetChangeProcessDTO> getChangeProcess(String datasetName) {
        List<DatasetVersionEntity> versions = datasetVersionService.listVersions(datasetName, true);
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
            row.setJobState(v.getJobState());
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
        // id 是 timestamp 字段，IginX 读回可能为 null，用 createTime 兜底
        node.setVersionId(v.getId() != null ? v.getId() : v.getCreateTime());
        node.setDatasetName(v.getDatasetName());
        node.setVersionNo(v.getVersionNo());
        node.setProvenanceType(v.getProvenanceType());
        node.setProvenanceLabel(label(v.getProvenanceType()));
        node.setStoragePath(v.getStoragePath());
        node.setOperator(v.getOperator());
        node.setClientIp(v.getClientIp());
        node.setCreateTime(v.getCreateTime());
        node.setRemark(v.getRemark());
        node.setDeleted(v.isDeleted());
        node.setJobState(v.getJobState());
        node.setFocus(focus);
        node.setDerivationConfig(parseConfig(v.getDerivationConfig()));
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
