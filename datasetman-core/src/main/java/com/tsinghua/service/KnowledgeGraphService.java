package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.KnowledgeGraphQueryRequest;
import com.tsinghua.entity.KnowledgeGraphEntity;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 知识图谱管理服务
 * 图谱元信息存储于 relational_system.knowledge_graphs；
 * 节点/关系CSV数据入库到 knowledge_graphs.&lt;图谱名称&gt;.nodes / knowledge_graphs.&lt;图谱名称&gt;.edges，
 * 详情查询时解析为G6可视化所需的节点/边结构。
 */
@Slf4j
@Service
public class KnowledgeGraphService {

    private static final String META_PREFIX = "relational_system.knowledge_graphs";
    private static final String DATA_NAMESPACE = "knowledge_graphs";

    /** INSERT单批行数，避免单条SQL过长 */
    private static final int INSERT_BATCH_SIZE = 200;
    /** 详情查询单次最多加载的关系行数（大图保护） */
    private static final int MAX_EDGE_SCAN = 100_000;
    /** 单元格最大长度保护 */
    private static final int MAX_CELL_LENGTH = 2000;

    private static final List<String> ID_COLUMN_NAMES = Arrays.asList(":id", "id", "nodeid", "node_id");
    private static final List<String> LABEL_COLUMN_NAMES = Arrays.asList(":label", ":labels", "label", "labels");
    private static final List<String> SOURCE_COLUMN_NAMES =
            Arrays.asList(":start_id", "startid", "start_id", "source", "from", "src");
    private static final List<String> TARGET_COLUMN_NAMES =
            Arrays.asList(":end_id", "endid", "end_id", "target", "to", "dst");
    private static final List<String> TYPE_COLUMN_NAMES =
            Arrays.asList(":type", ":relationship", "type", "relationship");

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    /**
     * 上传图谱：解析节点/关系CSV并入库到 knowledge_graphs.<图谱名称>.nodes/.edges，写入元信息
     *
     * @return 图谱元信息实体
     */
    public KnowledgeGraphEntity uploadGraph(String name, String description,
                                            MultipartFile nodesFile, MultipartFile edgesFile) {
        if (!StringUtils.hasText(name)) {
            throw new IllegalArgumentException("图谱名称不能为空");
        }
        if (!name.matches("^[0-9A-Za-z_\\-\\u4e00-\\u9fa5]{1,50}$")) {
            throw new IllegalArgumentException("图谱名称仅支持中文、字母、数字、下划线和短横线，长度不超过50");
        }
        if (nodesFile == null || nodesFile.isEmpty()) {
            throw new IllegalArgumentException("请上传节点数据文件");
        }
        if (edgesFile == null || edgesFile.isEmpty()) {
            throw new IllegalArgumentException("请上传关系数据文件");
        }
        // 图谱名称存在检测（同名且未删除的图谱不允许重复创建）
        if (queryByName(name) != null) {
            throw new IllegalArgumentException("知识图谱名称已存在: " + name);
        }

        List<String[]> nodeRows = parseCsvFile(nodesFile, "nodes.csv");
        List<String[]> edgeRows = parseCsvFile(edgesFile, "edges.csv");
        if (nodeRows.size() < 2) {
            throw new IllegalArgumentException("nodes.csv至少需要表头和一行节点数据");
        }

        // 解析表头与特殊列（id/label、source/target/type），兼容neo4j export格式与通用格式
        NodeTableMeta nodeMeta = resolveNodeMeta(nodeRows.get(0));
        EdgeTableMeta edgeMeta = edgeRows.size() >= 1 ? resolveEdgeMeta(edgeRows.get(0)) : null;

        long timestamp = System.currentTimeMillis();
        String nodePath = nodePathOf(name);
        String edgePath = edgePathOf(name);

        // 全新上传前清理可能的历史残留数据（如上次上传中途失败），保证幂等
        cleanGraphData(nodePath, edgePath);

        long nodeCount = insertCsvRows(nodePath, nodeMeta.columns, nodeRows);
        long edgeCount = 0;
        if (edgeMeta != null && edgeRows.size() > 1) {
            edgeCount = insertCsvRows(edgePath, edgeMeta.columns, edgeRows);
        }

        // 校验关系端点是否都能在节点中找到（仅记录告警，不阻断入库）
        if (edgeMeta != null && edgeCount > 0) {
            Set<String> nodeIds = scanNodeIds(nodePath, nodeMeta);
            Set<String> edgeEndpointIds = scanEdgeEndpointIds(edgePath, edgeMeta);
            long missing = edgeEndpointIds.stream().filter(id -> !nodeIds.contains(id)).count();
            if (missing > 0) {
                log.warn("知识图谱[{}]存在{}个关系端点在节点表中未找到", name, missing);
            }
        }

        String operator = OperationLogAspect.getCurrentUser();
        String clientIp = OperationLogAspect.getClientIp();
        String owner = AuthUtil.getCurrentUsername();

        KnowledgeGraphEntity entity = new KnowledgeGraphEntity();
        entity.setId(timestamp);
        entity.setName(name);
        entity.setDescription(description);
        entity.setNodePath(nodePath);
        entity.setEdgePath(edgePath);
        entity.setNodeCount(nodeCount);
        entity.setEdgeCount(edgeCount);
        entity.setNodeColumns(JSON.toJSONString(nodeMeta.toJsonObject()));
        entity.setEdgeColumns(edgeMeta != null ? JSON.toJSONString(edgeMeta.toJsonObject()) : "[]");
        entity.setOwner(owner);
        entity.setCreateTime(timestamp);
        entity.setOperator(operator);
        entity.setClientIp(clientIp);
        entity.setDeleted(false);

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(entity);

        log.info("知识图谱已上传。名称: {}, 节点: {}, 关系: {}, id: {}", name, nodeCount, edgeCount, timestamp);
        return entity;
    }

    /**
     * 按名称查询图谱元信息
     */
    public KnowledgeGraphEntity queryByName(String name) {
        try {
            String sql = "select * from %s where name = '%s' AND deleted = false";
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                if (!"unknown".equals(currentUser)) {
                    sql += " AND owner = '" + currentUser + "'";
                }
            }
            sql += " ORDER BY createTime DESC LIMIT 1;";
            String formatSQL = String.format(sql, META_PREFIX, escape(name));
            SessionExecuteSqlResult res = iginxSession.executeSql(formatSQL);
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);
            if (records.isEmpty()) {
                return null;
            }
            return mapToEntity(records.get(0));
        } catch (Exception e) {
            log.error("按名称查询知识图谱失败, name={}", name, e);
            return null;
        }
    }

    /**
     * 分页查询图谱列表（支持名称模糊查询）
     */
    public List<KnowledgeGraphEntity> queryGraphs(KnowledgeGraphQueryRequest request) {
        int pageNum = request.getPageNum() != null && request.getPageNum() > 0 ? request.getPageNum() : 1;
        int pageSize = request.getPageSize() != null && request.getPageSize() > 0 ? request.getPageSize() : 100;
        try {
            StringBuilder sql = new StringBuilder("SELECT * FROM ")
                    .append(META_PREFIX)
                    .append(" WHERE deleted = false");

            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                if (!"unknown".equals(currentUser)) {
                    sql.append(" AND owner = '").append(currentUser).append("'");
                }
            }

            if (StringUtils.hasText(request.getName())) {
                sql.append(" AND name LIKE '%").append(escape(request.getName().trim())).append("%'");
            }

            sql.append(" ORDER BY createTime DESC")
                    .append(" LIMIT ").append(pageSize)
                    .append(" OFFSET ").append((long) (pageNum - 1) * pageSize)
                    .append(";");

            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            return records.stream()
                    .map(this::mapToEntity)
                    .sorted(Comparator.comparing(KnowledgeGraphEntity::getCreateTime).reversed())
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("查询知识图谱列表失败", e);
            return new ArrayList<>();
        }
    }

    /**
     * 查询图谱总数（与分页查询相同的过滤条件）
     */
    public long countGraphs(String name) {
        try {
            StringBuilder sql = new StringBuilder("SELECT COUNT(1) FROM ")
                    .append(META_PREFIX)
                    .append(" WHERE deleted = false");

            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                if (!"unknown".equals(currentUser)) {
                    sql.append(" AND owner = '").append(currentUser).append("'");
                }
            }

            if (StringUtils.hasText(name)) {
                sql.append(" AND name LIKE '%").append(escape(name.trim())).append("%'");
            }

            sql.append(";");

            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            List<List<Object>> values = res.getValues();
            if (!values.isEmpty() && !values.get(0).isEmpty() && values.get(0).get(0) != null) {
                return Long.parseLong(String.valueOf(values.get(0).get(0)));
            }
            return 0;
        } catch (Exception e) {
            log.error("统计知识图谱总数失败", e);
            return 0;
        }
    }

    /**
     * 图谱名称存在检测（同名且未删除视为已存在）
     */
    public boolean nameExists(String name) {
        return StringUtils.hasText(name) && queryByName(name) != null;
    }

    /**
     * 删除knowledge_graphs.<名称>.nodes/.edges数据表内容；失败仅告警
     */
    private void cleanGraphData(String nodePath, String edgePath) {
        for (String path : Arrays.asList(nodePath, edgePath)) {
            if (!StringUtils.hasText(path)) {
                continue;
            }
            try {
                iginxSession.executeSql("DELETE FROM " + path);
            } catch (Exception e) {
                log.warn("清理知识图谱数据失败: {}", path, e);
            }
        }
    }

    /**
     * 详情查询：增量分页返回G6可视化结构。
     * 节点按存储顺序分页返回（仅返回本次新增的增量）；
     * 关系返回两端点均已加载的边（保证G6可直接渲染，每条边只下发一次）。
     *
     * @param name       图谱名称
     * @param nodeOffset 已加载的节点数（含本次之前的所有页）
     * @param nodeLimit  本次加载的节点数
     */
    public Map<String, Object> getGraphData(String name, int nodeOffset, int nodeLimit) {
        KnowledgeGraphEntity graph = queryByName(name);
        if (graph == null) {
            throw new RuntimeException("知识图谱不存在或无权访问: " + name);
        }
        if (nodeLimit <= 0) {
            nodeLimit = 300;
        }
        if (nodeLimit > 2000) {
            nodeLimit = 2000;
        }
        if (nodeOffset < 0) {
            nodeOffset = 0;
        }

        NodeTableMeta nodeMeta = NodeTableMeta.fromJson(graph.getNodeColumns());
        EdgeTableMeta edgeMeta = EdgeTableMeta.fromJson(graph.getEdgeColumns());

        // 一次性取回前 offset+limit 个节点（key升序），前 offset 个为已加载部分，尾部为本次增量
        int loadedTotal = Math.min(nodeOffset + nodeLimit, Integer.MAX_VALUE);
        List<Map<String, Object>> loadedRecords = queryRecords(graph.getNodePath(), loadedTotal);
        long totalNodes = graph.getNodeCount() != null ? graph.getNodeCount() : loadedRecords.size();

        // 按节点id去重（保持首次出现顺序），生成G6节点
        Set<String> seenIds = new LinkedHashSet<>();
        List<Map<String, Object>> loadedNodes = new ArrayList<>();
        for (Map<String, Object> record : loadedRecords) {
            String id = cellValue(record, nodeMeta.idColumn);
            if (id == null || seenIds.contains(id)) {
                continue;
            }
            seenIds.add(id);
            loadedNodes.add(toG6Node(record, nodeMeta));
        }

        // 本次增量 = 去重后位于 [nodeOffset, nodeOffset+limit) 区间的节点
        int from = Math.min(nodeOffset, loadedNodes.size());
        int to = Math.min(nodeOffset + nodeLimit, loadedNodes.size());
        List<Map<String, Object>> newNodes = new ArrayList<>(loadedNodes.subList(from, to));

        // 扫描关系表，筛选两端均已加载的边（每条边只在首次两端齐备时下发）
        List<Map<String, Object>> newEdges = new ArrayList<>();
        if (edgeMeta != null && !seenIds.isEmpty()) {
            List<Map<String, Object>> edgeRecords = queryRecords(graph.getEdgePath(), MAX_EDGE_SCAN);
            for (Map<String, Object> record : edgeRecords) {
                String source = cellValue(record, edgeMeta.sourceColumn);
                String target = cellValue(record, edgeMeta.targetColumn);
                if (source == null || target == null || !seenIds.contains(source) || !seenIds.contains(target)) {
                    continue;
                }
                newEdges.add(toG6Edge(record, edgeMeta));
            }
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("graph", toGraphSummary(graph));
        data.put("totalNodes", totalNodes);
        data.put("totalEdges", graph.getEdgeCount() != null ? graph.getEdgeCount() : 0L);
        data.put("loadedNodeCount", loadedNodes.size());
        // 尚有未扫描的节点行（本次到达请求数上限），或去重后的节点尚未全部下发
        boolean hasMore = to < loadedNodes.size() || loadedRecords.size() >= loadedTotal;
        data.put("hasMore", hasMore);
        data.put("nodeColumns", nodeMeta.columns);
        data.put("edgeColumns", edgeMeta != null ? edgeMeta.columns : new ArrayList<>());
        data.put("nodes", newNodes);
        data.put("edges", newEdges);
        return data;
    }

    /**
     * 供前端详情页展示的图谱概要
     */
    private Map<String, Object> toGraphSummary(KnowledgeGraphEntity graph) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("id", graph.getId());
        summary.put("name", graph.getName());
        summary.put("description", graph.getDescription());
        summary.put("nodePath", graph.getNodePath());
        summary.put("edgePath", graph.getEdgePath());
        summary.put("nodeCount", graph.getNodeCount());
        summary.put("edgeCount", graph.getEdgeCount());
        summary.put("operator", graph.getOperator());
        summary.put("owner", graph.getOwner());
        summary.put("createTime", graph.getCreateTime());
        return summary;
    }

    private Map<String, Object> toG6Node(Map<String, Object> record, NodeTableMeta meta) {
        String id = cellValue(record, meta.idColumn);
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", id);
        String labelRaw = cellValue(record, meta.labelColumn);
        String label = StringUtils.hasText(labelRaw)
                ? labelRaw
                : firstNonBlankProperty(record, meta.columns, meta.idColumn, "name", "title", "名称");
        node.put("label", StringUtils.hasText(label) ? label : id);
        // 节点分类标签（仅取:LABEL/label列，避免退化到名称列导致每节点一类）
        node.put("labelType", StringUtils.hasText(labelRaw) ? labelRaw : "未分类");
        Map<String, Object> properties = new LinkedHashMap<>();
        for (String column : meta.columns) {
            if (column.equals(meta.idColumn) || column.equals(meta.labelColumn)) {
                continue;
            }
            String value = cellValue(record, column);
            if (value != null && !value.isEmpty()) {
                properties.put(column, value);
            }
        }
        node.put("properties", properties);
        return node;
    }

    private Map<String, Object> toG6Edge(Map<String, Object> record, EdgeTableMeta meta) {
        Map<String, Object> edge = new LinkedHashMap<>();
        edge.put("source", cellValue(record, meta.sourceColumn));
        edge.put("target", cellValue(record, meta.targetColumn));
        String label = cellValue(record, meta.typeColumn);
        edge.put("label", StringUtils.hasText(label) ? label : "");
        Map<String, Object> properties = new LinkedHashMap<>();
        for (String column : meta.columns) {
            if (column.equals(meta.sourceColumn) || column.equals(meta.targetColumn)
                    || column.equals(meta.typeColumn)) {
                continue;
            }
            String value = cellValue(record, column);
            if (value != null && !value.isEmpty()) {
                properties.put(column, value);
            }
        }
        edge.put("properties", properties);
        return edge;
    }

    /**
     * 从表中取前 limit 行记录（key升序）
     */
    private List<Map<String, Object>> queryRecords(String path, int limit) {
        String sql = "SELECT * FROM " + path + " LIMIT " + limit + ";";
        try {
            SessionExecuteSqlResult res = iginxSession.executeSql(sql);
            return ConvertUtil.getRecords(res);
        } catch (Exception e) {
            throw new RuntimeException("查询图数据失败: " + path + ", " + e.getMessage(), e);
        }
    }

    private Set<String> scanNodeIds(String nodePath, NodeTableMeta nodeMeta) {
        Set<String> ids = new HashSet<>();
        for (Map<String, Object> record : queryRecords(nodePath, MAX_EDGE_SCAN)) {
            String id = cellValue(record, nodeMeta.idColumn);
            if (id != null) {
                ids.add(id);
            }
        }
        return ids;
    }

    private Set<String> scanEdgeEndpointIds(String edgePath, EdgeTableMeta edgeMeta) {
        Set<String> ids = new HashSet<>();
        for (Map<String, Object> record : queryRecords(edgePath, MAX_EDGE_SCAN)) {
            String source = cellValue(record, edgeMeta.sourceColumn);
            String target = cellValue(record, edgeMeta.targetColumn);
            if (source != null) {
                ids.add(source);
            }
            if (target != null) {
                ids.add(target);
            }
        }
        return ids;
    }

    /**
     * 将解析后的CSV行批量INSERT入库，返回成功写入的行数
     */
    private long insertCsvRows(String path, List<String> columns, List<String[]> rows) {
        // rows[0]为表头，数据从第1行开始
        List<String[]> dataRows = rows.subList(1, rows.size());
        long written = 0;
        long baseKey = System.currentTimeMillis();
        StringBuilder values = new StringBuilder();
        int batchCount = 0;

        for (int i = 0; i < dataRows.size(); i++) {
            String[] row = dataRows.get(i);
            long key = baseKey + i;
            if (batchCount > 0) {
                values.append(", ");
            }
            values.append("(").append(key);
            for (int c = 0; c < columns.size(); c++) {
                String cell = c < row.length ? row[c] : "";
                values.append(", '").append(escape(cell)).append("'");
            }
            values.append(")");
            batchCount++;
            written++;

            if (batchCount >= INSERT_BATCH_SIZE || i == dataRows.size() - 1) {
                StringBuilder sql = new StringBuilder("INSERT INTO ").append(path)
                        .append(" (key");
                for (String column : columns) {
                    sql.append(", ").append(column);
                }
                sql.append(") VALUES ").append(values).append(";");
                try {
                    iginxSession.executeSql(sql.toString());
                } catch (Exception e) {
                    throw new RuntimeException("图数据入库失败: " + path + " 第" + (i - batchCount + 2) + "行附近, " + e.getMessage(), e);
                }
                values.setLength(0);
                batchCount = 0;
            }
        }
        return written;
    }

    // ==================== CSV解析与表头处理 ====================

    private List<String[]> parseCsvFile(MultipartFile file, String displayName) {
        String content;
        try {
            content = new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException("读取" + displayName + "失败: " + e.getMessage(), e);
        }
        if (content.isEmpty()) {
            throw new IllegalArgumentException(displayName + "内容为空");
        }
        List<String[]> rows = parseCsv(content);
        if (rows.isEmpty() || rows.get(0).length == 0
                || rows.get(0)[0] == null || rows.get(0)[0].isEmpty()) {
            throw new IllegalArgumentException(displayName + "缺少有效的表头行");
        }
        return rows;
    }

    /**
     * 解析CSV文本（支持双引号包裹、引号转义、CRLF/LF换行），返回行-列数组，首行为表头
     */
    static List<String[]> parseCsv(String content) {
        // 去除UTF-8 BOM
        if (content.codePointAt(0) == 0xFEFF) {
            content = content.substring(1);
        }
        List<String[]> rows = new ArrayList<>();
        List<String> currentRow = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean inQuotes = false;
        boolean cellStarted = false;

        for (int i = 0; i < content.length(); i++) {
            char ch = content.charAt(i);
            if (inQuotes) {
                if (ch == '"') {
                    if (i + 1 < content.length() && content.charAt(i + 1) == '"') {
                        cell.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cell.append(ch);
                }
            } else if (ch == '"' && cell.length() == 0) {
                inQuotes = true;
                cellStarted = true;
            } else if (ch == ',') {
                currentRow.add(cell.toString());
                cell.setLength(0);
                cellStarted = false;
            } else if (ch == '\r') {
                // 忽略，由\n统一处理换行
            } else if (ch == '\n') {
                currentRow.add(cell.toString());
                cell.setLength(0);
                cellStarted = false;
                rows.add(currentRow.toArray(new String[0]));
                currentRow.clear();
            } else {
                cell.append(ch);
                cellStarted = true;
            }
        }
        // 收尾：最后一行（含空行）
        if (cell.length() > 0 || cellStarted || !currentRow.isEmpty()) {
            currentRow.add(cell.toString());
            rows.add(currentRow.toArray(new String[0]));
        }
        // 过滤全空行
        rows.removeIf(row -> row.length == 1 && (row[0] == null || row[0].trim().isEmpty()));
        return rows;
    }

    private NodeTableMeta resolveNodeMeta(String[] header) {
        NodeTableMeta meta = new NodeTableMeta();
        meta.rawColumns = new ArrayList<>();
        for (String raw : header) {
            meta.rawColumns.add(raw == null ? "" : raw.trim());
        }
        int idIndex = findColumn(meta.rawColumns, ID_COLUMN_NAMES, 0);
        int labelIndex = findColumn(meta.rawColumns, LABEL_COLUMN_NAMES, -1);
        // 列清洗后保持原始顺序，保证INSERT时列名与单元格按下标一一对应
        meta.columns = sanitizeColumns(meta.rawColumns);
        meta.idColumn = idIndex >= 0 ? meta.columns.get(idIndex) : null;
        meta.labelColumn = labelIndex >= 0 ? meta.columns.get(labelIndex) : null;
        return meta;
    }

    private EdgeTableMeta resolveEdgeMeta(String[] header) {
        EdgeTableMeta meta = new EdgeTableMeta();
        meta.rawColumns = new ArrayList<>();
        for (String raw : header) {
            meta.rawColumns.add(raw == null ? "" : raw.trim());
        }
        if (meta.rawColumns.size() < 2) {
            throw new IllegalArgumentException("edges.csv表头至少需要两列（起点、终点）");
        }
        int sourceIndex = findColumn(meta.rawColumns, SOURCE_COLUMN_NAMES, 0);
        int targetIndex = findColumn(meta.rawColumns, TARGET_COLUMN_NAMES, 1);
        if (targetIndex == sourceIndex) {
            targetIndex = sourceIndex == 0 ? 1 : 0;
        }
        int typeIndex = findColumn(meta.rawColumns, TYPE_COLUMN_NAMES, -1);
        meta.columns = sanitizeColumns(meta.rawColumns);
        meta.sourceColumn = sourceIndex >= 0 ? meta.columns.get(sourceIndex) : null;
        meta.targetColumn = targetIndex >= 0 ? meta.columns.get(targetIndex) : null;
        meta.typeColumn = typeIndex >= 0 ? meta.columns.get(typeIndex) : null;
        return meta;
    }

    /**
     * 按候选名（忽略大小写）查找列下标，找不到时返回fallback（<0表示无默认）
     */
    private int findColumn(List<String> rawColumns, List<String> candidates, int fallback) {
        for (int i = 0; i < rawColumns.size(); i++) {
            String normalized = rawColumns.get(i).toLowerCase().replace(" ", "");
            if (candidates.contains(normalized)) {
                return i;
            }
        }
        return fallback >= 0 && fallback < rawColumns.size() ? fallback : -1;
    }

    /**
     * 列名清洗为IGinX路径安全字符，保持原始列顺序并全局唯一
     */
    private List<String> sanitizeColumns(List<String> rawColumns) {
        List<String> result = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (int i = 0; i < rawColumns.size(); i++) {
            String name = sanitizeColumnName(rawColumns.get(i));
            if (name.isEmpty()) {
                name = "col" + i;
            }
            while (used.contains(name)) {
                name = name + "_";
            }
            used.add(name);
            result.add(name);
        }
        return result;
    }

    static String sanitizeColumnName(String raw) {
        if (raw == null) {
            return "";
        }
        String name = raw.trim()
                .replaceAll("[^0-9A-Za-z_\\-\\u4e00-\\u9fa5]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");
        // "key"是INSERT列描述中的保留字，需改名避免冲突
        if ("key".equalsIgnoreCase(name)) {
            name = "key_";
        }
        return name;
    }

    private String firstNonBlankProperty(Map<String, Object> record, List<String> columns,
                                         String excludeColumn, String... preferredNames) {
        for (String preferred : preferredNames) {
            for (String column : columns) {
                if (column.equalsIgnoreCase(preferred) && !column.equals(excludeColumn)) {
                    String value = cellValue(record, column);
                    if (StringUtils.hasText(value)) {
                        return value;
                    }
                }
            }
        }
        return null;
    }

    /**
     * 读取记录中指定列的字符串值（IGinX可能返回byte[]或字符串）
     */
    private String cellValue(Map<String, Object> record, String column) {
        if (column == null) {
            return null;
        }
        Object value = record.get(column);
        if (value == null) {
            // 兼容带前缀的列名
            value = record.entrySet().stream()
                    .filter(e -> e.getKey().endsWith("." + column) || e.getKey().equalsIgnoreCase(column))
                    .map(Map.Entry::getValue)
                    .findFirst().orElse(null);
        }
        if (value == null) {
            return null;
        }
        if (value instanceof byte[]) {
            return new String((byte[]) value, StandardCharsets.UTF_8);
        }
        String str = String.valueOf(value);
        return str.length() > MAX_CELL_LENGTH ? str.substring(0, MAX_CELL_LENGTH) : str;
    }

    private static String nodePathOf(String name) {
        return DATA_NAMESPACE + "." + name + ".nodes";
    }

    private static String edgePathOf(String name) {
        return DATA_NAMESPACE + "." + name + ".edges";
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        // 单引号转义；换行替换为空格，避免SQL字面量跨行
        return value.replace("'", "''").replace("\r", " ").replace("\n", " ");
    }

    private KnowledgeGraphEntity mapToEntity(Map<String, Object> record) {
        KnowledgeGraphEntity entity = new KnowledgeGraphEntity();
        record.forEach((k, v) -> {
            String fieldName = k.replace(META_PREFIX + ".", "");
            ConvertUtil.setEntityField(entity, META_PREFIX, fieldName, v);
        });
        // id 是 IGinX timestamp 列，SELECT * 不返回该列，用 createTime 补齐
        if (entity.getId() == null && entity.getCreateTime() != null) {
            entity.setId(entity.getCreateTime());
        }
        return entity;
    }

    /**
     * 节点表元信息（列布局与特殊列），随图谱元数据持久化
     */
    public static class NodeTableMeta {
        List<String> rawColumns;
        List<String> columns;
        String idColumn;
        String labelColumn;

        public static NodeTableMeta fromJson(String json) {
            NodeTableMeta meta = new NodeTableMeta();
            meta.columns = new ArrayList<>();
            meta.rawColumns = new ArrayList<>();
            if (StringUtils.hasText(json)) {
                try {
                    JSONObject obj = JSON.parseObject(json);
                    if (obj.getJSONArray("columns") != null) {
                        meta.columns = obj.getJSONArray("columns").toJavaList(String.class);
                        meta.rawColumns = meta.columns;
                    }
                    meta.idColumn = obj.getString("idColumn");
                    meta.labelColumn = obj.getString("labelColumn");
                } catch (Exception e) {
                    log.warn("解析节点列信息失败: {}", json, e);
                }
            }
            // 兼容旧数据：无记录时默认第一列为id
            if (meta.idColumn == null && !meta.columns.isEmpty()) {
                meta.idColumn = meta.columns.get(0);
            }
            return meta;
        }

        JSONObject toJsonObject() {
            JSONObject obj = new JSONObject();
            obj.put("columns", columns);
            obj.put("idColumn", idColumn);
            if (labelColumn != null) {
                obj.put("labelColumn", labelColumn);
            }
            return obj;
        }
    }

    /**
     * 关系表元信息（列布局与特殊列），随图谱元数据持久化
     */
    public static class EdgeTableMeta {
        List<String> rawColumns;
        List<String> columns;
        String sourceColumn;
        String targetColumn;
        String typeColumn;

        public static EdgeTableMeta fromJson(String json) {
            EdgeTableMeta meta = new EdgeTableMeta();
            meta.columns = new ArrayList<>();
            meta.rawColumns = new ArrayList<>();
            if (StringUtils.hasText(json)) {
                try {
                    JSONObject obj = JSON.parseObject(json);
                    if (obj.getJSONArray("columns") != null) {
                        meta.columns = obj.getJSONArray("columns").toJavaList(String.class);
                        meta.rawColumns = meta.columns;
                    }
                    meta.sourceColumn = obj.getString("sourceColumn");
                    meta.targetColumn = obj.getString("targetColumn");
                    meta.typeColumn = obj.getString("typeColumn");
                } catch (Exception e) {
                    log.warn("解析关系列信息失败: {}", json, e);
                }
            }
            if (meta.sourceColumn == null && meta.columns.size() > 0) {
                meta.sourceColumn = meta.columns.get(0);
            }
            if (meta.targetColumn == null && meta.columns.size() > 1) {
                meta.targetColumn = meta.columns.get(1);
            }
            return meta;
        }

        JSONObject toJsonObject() {
            JSONObject obj = new JSONObject();
            obj.put("columns", columns);
            obj.put("sourceColumn", sourceColumn);
            obj.put("targetColumn", targetColumn);
            if (typeColumn != null) {
                obj.put("typeColumn", typeColumn);
            }
            return obj;
        }
    }
}
