package com.tsinghua.service;

import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.util.AuthUtil;
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

    @Autowired
    private com.tsinghua.auth.service.DataPermissionService dataPermissionService;

    /**
     * 以某个版本为中心，在「可见子图」上向上追溯全部上游、向下展开全部下游，构成图谱。
     *
     * 节点可见性按其 storagePath 的数据权限（与版本树同一套 ACL）判定：管理员可见全部，
     * 普通用户仅可见 storagePath 在已授权前缀内的版本；已禁用版本保留（图谱置灰展示）。
     * 旁系血缘语义：不可达即不入图 —— 无论是图结构上不可达，还是权限导致的不可达，
     * 无权限的桥接节点不会把另一侧的子图带进结果。
     *
     * @param versionId   聚焦版本（恒可见）
     * @param sideLineage 是否包含旁系血缘：true 时把同数据集名的所有可见版本也作为遍历起点（含独立版本树）
     */
    public LineageGraphDTO getLineageGraph(Long versionId, boolean sideLineage) {
        LineageGraphDTO graph = new LineageGraphDTO();
        graph.setFocusVersionId(versionId);

        // 全量载入后按 storagePath 数据权限过滤（与版本树同一套 ACL，但保留已禁用版本）
        List<DatasetVersionEntity> all = datasetVersionService.listAllVersions();
        boolean admin = AuthUtil.isAdmin();
        Set<String> accessibleTables = null;
        if (!admin) {
            List<String> tables = dataPermissionService.getCurrentUserAccessibleTables();
            accessibleTables = (tables == null || tables.isEmpty()) ? Collections.emptySet() : new HashSet<>(tables);
        }
        Map<Long, DatasetVersionEntity> versionMap = new HashMap<>();
        for (DatasetVersionEntity v : all) {
            Long key = versionKey(v);
            if (key == null) continue;
            if (!admin && !accessibleTables.contains(v.getStoragePath())) continue;
            versionMap.put(key, v);
        }
        // 焦点兜底：焦点恒可见（含 id 与 createTime 不一致等历史场景）
        DatasetVersionEntity focus = versionMap.get(versionId);
        if (focus == null) {
            focus = datasetVersionService.queryVersion(versionId);
            if (focus != null) {
                versionMap.put(versionKey(focus), focus);
            }
        }
        if (focus == null) {
            return graph;
        }
        Set<Long> visibleIds = new HashSet<>(versionMap.keySet());

        // 血缘边索引：边表 + 按版本的 upstreamVersionIds 兜底补边（后者覆盖边表脏数据/缺失）
        List<DatasetLineageEntity> allEdges = datasetVersionService.listAllEdges();
        Map<Long, List<DatasetLineageEntity>> byFrom = new HashMap<>();
        Map<Long, List<DatasetLineageEntity>> byTo = new HashMap<>();
        for (DatasetVersionEntity v : versionMap.values()) {
            List<Long> upstreamIds = datasetVersionService.parseUpstreamIds(v);
            Long to = versionKey(v);
            for (int i = 0; i < upstreamIds.size(); i++) {
                Long uid = upstreamIds.get(i);
                if (uid == null) continue;
                boolean duplicated = allEdges.stream().anyMatch(e ->
                        uid.equals(e.getFromVersionId()) && to.equals(e.getToVersionId()));
                if (duplicated) continue;
                DatasetLineageEntity supplemental = new DatasetLineageEntity();
                supplemental.setFromVersionId(uid);
                supplemental.setToVersionId(to);
                supplemental.setRelationType(label(v.getProvenanceType()));
                supplemental.setPrimary(i == 0);
                allEdges.add(supplemental);
            }
        }
        for (DatasetLineageEntity e : allEdges) {
            if (e.getFromVersionId() != null) byFrom.computeIfAbsent(e.getFromVersionId(), k -> new ArrayList<>()).add(e);
            if (e.getToVersionId() != null) byTo.computeIfAbsent(e.getToVersionId(), k -> new ArrayList<>()).add(e);
        }

        // 在可见子图上从焦点双向 BFS；sideLineage 时同名数据集的可见版本也作为遍历起点
        Set<Long> visited = new LinkedHashSet<>();
        Set<DatasetLineageEntity> edges = new LinkedHashSet<>();
        Deque<Long> queue = new ArrayDeque<>();
        visited.add(versionId);
        queue.add(versionId);
        if (sideLineage && focus.getDatasetName() != null) {
            for (Map.Entry<Long, DatasetVersionEntity> entry : versionMap.entrySet()) {
                if (focus.getDatasetName().equals(entry.getValue().getDatasetName()) && visited.add(entry.getKey())) {
                    queue.add(entry.getKey());
                }
            }
        }
        while (!queue.isEmpty()) {
            Long cur = queue.poll();
            for (DatasetLineageEntity e : byTo.getOrDefault(cur, Collections.emptyList())) {
                edges.add(e);
                Long from = e.getFromVersionId();
                if (from != null && visibleIds.contains(from) && visited.add(from)) queue.add(from);
            }
            for (DatasetLineageEntity e : byFrom.getOrDefault(cur, Collections.emptyList())) {
                edges.add(e);
                Long to = e.getToVersionId();
                if (to != null && visibleIds.contains(to) && visited.add(to)) queue.add(to);
            }
        }

        // visited 中的节点全部存在于版本树数据源，直接输出；边两端必然可见
        for (Long id : visited) {
            DatasetVersionEntity v = versionMap.get(id);
            if (v != null) {
                graph.getNodes().add(toNode(v, id.equals(versionId)));
            }
        }
        for (DatasetLineageEntity e : edges) {
            if (!visibleIds.contains(e.getFromVersionId()) || !visibleIds.contains(e.getToVersionId())) {
                continue;
            }
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
        List<DatasetVersionEntity> versions = datasetVersionService.listVersions(datasetName, true).stream()
                .filter(this::hasOwnerPermission)
                .collect(Collectors.toList());
        Map<Long, DatasetVersionEntity> cache = new HashMap<>();
        versions.forEach(v -> cache.put(versionKey(v), v));

        List<DatasetChangeProcessDTO> rows = new ArrayList<>();
        for (DatasetVersionEntity v : versions) {
            DatasetChangeProcessDTO row = new DatasetChangeProcessDTO();
            row.setVersionId(versionKey(v));
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

    /**
     * owner 权限判断：管理员可见全部；owner 为空的历史数据视为公共可见；
     * 其余仅创建者本人可见。
     */
    private boolean hasOwnerPermission(DatasetVersionEntity v) {
        if (v == null) {
            return false;
        }
        if (AuthUtil.isAdmin()) {
            return true;
        }
        if (v.getOwner() == null || v.getOwner().trim().isEmpty()) {
            return true;
        }
        String user = AuthUtil.getCurrentUsername();
        return user != null && user.equals(v.getOwner());
    }

    private LineageGraphDTO.Node toNode(DatasetVersionEntity v, boolean focus) {        LineageGraphDTO.Node node = new LineageGraphDTO.Node();
        node.setVersionId(versionKey(v));
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
            // 修复 fastjson2 生成的非法 JSON：数字 key 未加引号 {123:[0]} → {"123":[0]}
            String fixed = fixNumericKeysInJson(json);
            return JSONObject.parseObject(fixed);
        } catch (Exception e) {
            return Collections.singletonMap("raw", json);
        }
    }

    /** 修复 JSON 中未加引号的数字 key：{123: "x"} → {"123": "x"}，但不误改字符串内容里的数字 */
    private static String fixNumericKeysInJson(String json) {
        // 匹配对象开头的 { 后面跟的数字 key（后面是 : 或 : 加空格）
        // 排除字符串内部的 {数字:  ，只处理 JSON 结构层面
        return json.replaceAll("(?<=\\{)(\\d+)(?=\\s*:)", "\"$1\"")
                   .replaceAll("(?<=,)(\\d+)(?=\\s*:)", "\"$1\"");
    }

    /**
     * 统一的版本标识提取：IginX 读回的 id 字段可能为 null，用 createTime 兜底。
     * 系统里所有版本查询都通过 createTime（queryVersion(Long) 的 where createTime = ?）。
     */
    private static Long versionKey(DatasetVersionEntity v) {
        if (v == null) return null;
        return v.getId() != null ? v.getId() : v.getCreateTime();
    }
}
