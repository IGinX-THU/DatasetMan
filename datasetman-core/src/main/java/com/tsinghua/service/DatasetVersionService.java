package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import cn.edu.tsinghua.iginx.session_v2.DeleteClient;
import cn.edu.tsinghua.iginx.thrift.RemovedStorageEngineInfo;
import cn.edu.tsinghua.iginx.session.ClusterInfo;
import cn.edu.tsinghua.iginx.thrift.StorageEngineInfo;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.service.DataPermissionService;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.DatasetTreeDTO;
import com.tsinghua.dto.DatasetVersionRegisterRequest;
import com.tsinghua.entity.DatasetInfoEntity;
import com.tsinghua.entity.DatasetLineageEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.enums.ProvenanceType;
import com.tsinghua.util.CommonUtil;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * 数据集版本服务：own 逻辑数据集、版本、血缘边三张表。
 * 只负责元数据登记与查询，不负责数据物化（物化由各生产者在登记前完成）。
 */
@Slf4j
@Service
public class DatasetVersionService {

    public static final String DATASET_PREFIX = "relational_system.dataset";
    public static final String VERSION_PREFIX = "relational_system.dataset_version";
    public static final String LINEAGE_PREFIX = "relational_system.dataset_lineage";
    private static final AtomicLong ID_SEQUENCE = new AtomicLong(System.currentTimeMillis());

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    @Autowired
    private DataPermissionService dataPermissionService;

    // ====================================================================
    // 登记
    // ====================================================================

    /**
     * 登记一个数据集版本：不存在逻辑数据集则创建 → 写版本 → 写血缘边 → 登记数据权限前缀
     */
    public DatasetVersionEntity registerVersion(DatasetVersionRegisterRequest request) {
        ProvenanceType type = ProvenanceType.of(request.getProvenanceType());

        DatasetInfoEntity dataset = findDatasetByName(request.getDatasetName());
        if (dataset == null) {
            dataset = createDataset(request.getDatasetName(), request.getDescription(), request.getDataModality(), request.getProject());
        }
        // datasetId 是 DatasetInfoEntity 的 timestamp 字段，从 IginX 读回来可能为 null，用 createTime 兜底
        Long datasetId = dataset.getId() != null ? dataset.getId() : dataset.getCreateTime();

        long timestamp = nextId();
        String operator = OperationLogAspect.getCurrentUser();
        String clientIp = OperationLogAspect.getClientIp();

        // 默认主上游 = 本数据集最新版本（SOURCE 类型除外）
        List<Long> upstreams = request.getUpstreamVersionIds() == null
                ? new ArrayList<>() : new ArrayList<>(request.getUpstreamVersionIds());
        if (upstreams.isEmpty() && type != ProvenanceType.SOURCE) {
            DatasetVersionEntity latest = latestVersion(datasetId);
            if (latest != null) {
                upstreams.add(latest.getId());
            }
        }

        DatasetVersionEntity version = new DatasetVersionEntity();
        version.setId(timestamp);
        version.setDatasetId(datasetId);
        version.setDatasetName(dataset.getName());
        version.setVersionNo(CommonUtil.generateVersion(timestamp));
        version.setProvenanceType(type.name());
        version.setStoragePath(request.getStoragePath());
        version.setUpstreamVersionIds(JSONArray.toJSONString(upstreams));
        version.setDerivationConfig(request.getDerivationConfig() == null
                ? "{}" : JSONObject.toJSONString(request.getDerivationConfig()));
        version.setSchemaJson(nvl(request.getSchemaJson()));
        version.setRowCount(request.getRowCount() == null ? 0L : request.getRowCount());
        version.setSizeBytes(request.getSizeBytes() == null ? 0L : request.getSizeBytes());
        version.setCreateTime(timestamp);
        version.setOperator(operator);
        version.setClientIp(clientIp);
        version.setRemark(nvl(request.getRemark()));
        version.setDeleted(false);

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(version);

        // 血缘边：首个上游为主上游
        for (int i = 0; i < upstreams.size(); i++) {
            long edgeTs = nextId();
            DatasetLineageEntity edge = new DatasetLineageEntity();
            edge.setId(edgeTs);
            edge.setFromVersionId(upstreams.get(i));
            edge.setToVersionId(timestamp);
            edge.setRelationType(type.getRelationType());
            edge.setPrimary(i == 0);
            edge.setCreateTime(edgeTs);
            writeClient.writeMeasurement(edge);
        }

        // 数据权限：按版本 storagePath 授权（SOURCE 的前缀通常已由数据源注册时登记）
        if (!dataPermissionService.existTablePrefix(request.getStoragePath())) {
            dataPermissionService.saveTablePrefix(request.getStoragePath());
        }

        log.info("数据集版本已登记。dataset={}, version={}, type={}, storagePath={}",
                dataset.getName(), version.getVersionNo(), type, request.getStoragePath());
        return version;
    }

    public DatasetInfoEntity createDataset(String name, String description, String dataModality, String project) {
        long timestamp = nextId();
        DatasetInfoEntity dataset = new DatasetInfoEntity();
        dataset.setId(timestamp);
        dataset.setName(name);
        dataset.setDescription(nvl(description));
        dataset.setDataModality(StringUtils.hasText(dataModality) ? dataModality : "relational");
        dataset.setProject(StringUtils.hasText(project) ? project : "default");
        dataset.setOwner(AuthUtil.getCurrentUsername());
        dataset.setCreateTime(timestamp);
        dataset.setOperator(OperationLogAspect.getCurrentUser());
        dataset.setClientIp(OperationLogAspect.getClientIp());
        dataset.setDeleted(false);
        iginxClient.getWriteClient().writeMeasurement(dataset);
        log.info("逻辑数据集已创建。name={}, modality={}, id={}", name, dataModality, timestamp);
        return dataset;
    }

    // ====================================================================
    // 查询：逻辑数据集
    // ====================================================================

    public DatasetInfoEntity findDatasetByName(String name) {
        String sql = String.format("select * from %s where name = '%s';", DATASET_PREFIX, escape(name));
        return query(sql, DatasetInfoEntity::new, DATASET_PREFIX).stream()
                .filter(d -> !d.isDeleted())
                .max(Comparator.comparing(DatasetInfoEntity::getCreateTime))
                .orElse(null);
    }

    public DatasetInfoEntity findDatasetById(Long datasetId) {
        String sql = String.format("select * from %s where createTime = %d;", DATASET_PREFIX, datasetId);
        return query(sql, DatasetInfoEntity::new, DATASET_PREFIX).stream()
                .max(Comparator.comparing(DatasetInfoEntity::getCreateTime))
                .orElse(null);
    }

    public List<DatasetInfoEntity> listDatasets() {
        String sql = String.format("select * from %s;", DATASET_PREFIX);
        return query(sql, DatasetInfoEntity::new, DATASET_PREFIX).stream()
                .filter(d -> !d.isDeleted())
                .sorted(Comparator.comparing(DatasetInfoEntity::getCreateTime).reversed())
                .collect(Collectors.toList());
    }

    // ====================================================================
    // 查询：版本
    // ====================================================================

    public DatasetVersionEntity queryVersion(Long versionId) {
        String sql = String.format("select * from %s where createTime = %d;", VERSION_PREFIX, versionId);
        return query(sql, DatasetVersionEntity::new, VERSION_PREFIX).stream()
                .findFirst().orElse(null);
    }

    public DatasetVersionEntity queryVersionByStoragePath(String storagePath) {
        String sql = String.format("select * from %s where storagePath = '%s';", VERSION_PREFIX, escape(storagePath));
        return query(sql, DatasetVersionEntity::new, VERSION_PREFIX).stream()
                .filter(v -> !v.isDeleted())
                .max(Comparator.comparing(DatasetVersionEntity::getCreateTime))
                .orElse(null);
    }

    /** 某数据集的全部版本（含已软删，按时间倒序），供变化过程表格使用 */
    public List<DatasetVersionEntity> listVersions(Long datasetId, boolean includeDeleted) {
        String sql;
        if (datasetId != null && datasetId > 0) {
            sql = String.format("select * from %s where datasetId = %d;", VERSION_PREFIX, datasetId);
        } else {
            // datasetId 无效时返回空
            return new ArrayList<>();
        }
        return query(sql, DatasetVersionEntity::new, VERSION_PREFIX).stream()
                .filter(v -> includeDeleted || !v.isDeleted())
                .sorted(Comparator.comparing(DatasetVersionEntity::getCreateTime).reversed())
                .collect(Collectors.toList());
    }

    public DatasetVersionEntity latestVersion(Long datasetId) {
        List<DatasetVersionEntity> versions = listVersions(datasetId, false);
        return versions.isEmpty() ? null : versions.get(0);
    }

    /** 全部未删除版本，并按当前用户数据权限过滤（供右侧树使用） */
    public List<DatasetVersionEntity> listAllAccessibleVersions() {
        String sql = String.format("select * from %s;", VERSION_PREFIX);
        List<DatasetVersionEntity> all = query(sql, DatasetVersionEntity::new, VERSION_PREFIX).stream()
                .filter(v -> !v.isDeleted())
                .collect(Collectors.toList());
        if (AuthUtil.isAdmin()) {
            return all;
        }
        List<String> accessible = dataPermissionService.getCurrentUserAccessibleTables();
        if (CollectionUtils.isEmpty(accessible)) {
            return Collections.emptyList();
        }
        Set<String> set = new HashSet<>(accessible);
        return all.stream().filter(v -> set.contains(v.getStoragePath())).collect(Collectors.toList());
    }

    public List<DatasetTreeDTO> getDatasetTree() {
        Map<Long, DatasetTreeDTO> groups = new LinkedHashMap<>();
        listAllAccessibleVersions().stream()
                .sorted(Comparator.comparing(DatasetVersionEntity::getDatasetName, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(DatasetVersionEntity::getCreateTime, Comparator.nullsLast(Comparator.naturalOrder())))
                .forEach(v -> {
                    // datasetId 可能为 null（IginX timestamp 字段读回为 null），用 createTime 兜底
                    Long did = v.getDatasetId() != null ? v.getDatasetId() : v.getCreateTime();
                    DatasetTreeDTO dataset = groups.computeIfAbsent(did, id -> {
                        DatasetTreeDTO dto = new DatasetTreeDTO();
                        dto.setDatasetId(id);
                        dto.setDatasetName(v.getDatasetName());
                        return dto;
                    });
                    DatasetTreeDTO.Version version = new DatasetTreeDTO.Version();
                    Long vid = v.getId() != null ? v.getId() : v.getCreateTime();
                    version.setVersionId(vid);
                    version.setVersionNo(v.getVersionNo());
                    version.setStoragePath(v.getStoragePath());
                    version.setProvenanceType(v.getProvenanceType());
                    version.setCreateTime(v.getCreateTime());
                    version.setDeleted(v.isDeleted());
                    dataset.getVersions().add(version);
                });
        return new ArrayList<>(groups.values());
    }

    public List<Long> parseUpstreamIds(DatasetVersionEntity version) {
        if (version == null || version.getUpstreamVersionIds() == null || version.getUpstreamVersionIds().isEmpty()) {
            return Collections.emptyList();
        }
        try {
            return JSONArray.parseArray(version.getUpstreamVersionIds(), Long.class);
        } catch (Exception e) {
            log.warn("解析上游版本ID失败: {}", version.getUpstreamVersionIds());
            return Collections.emptyList();
        }
    }

    // ====================================================================
    // 查询：血缘边
    // ====================================================================

    public List<DatasetLineageEntity> listDownstreamEdges(Long versionId) {
        String sql = String.format("select * from %s where fromVersionId = %d;", LINEAGE_PREFIX, versionId);
        return query(sql, DatasetLineageEntity::new, LINEAGE_PREFIX);
    }

    public List<DatasetLineageEntity> listUpstreamEdges(Long versionId) {
        String sql = String.format("select * from %s where toVersionId = %d;", LINEAGE_PREFIX, versionId);
        return query(sql, DatasetLineageEntity::new, LINEAGE_PREFIX);
    }

    public List<DatasetLineageEntity> listAllEdges() {
        String sql = String.format("select * from %s;", LINEAGE_PREFIX);
        return query(sql, DatasetLineageEntity::new, LINEAGE_PREFIX);
    }

    // ====================================================================
    // 删除
    // ====================================================================

    /**
     * 软删除版本：存在未删除的下游版本时拒绝删除。
     * 只删元数据与权限前缀，物化数据的清理由调用方决定。
     */
    public void assertVersionDeletable(Long versionId) {
        DatasetVersionEntity version = queryVersion(versionId);
        if (version == null) {
            throw new RuntimeException("版本不存在: " + versionId);
        }
        List<Long> liveDownstream = listDownstreamEdges(versionId).stream()
                .map(DatasetLineageEntity::getToVersionId)
                .distinct()
                .map(this::queryVersion)
                .filter(v -> v != null && !v.isDeleted())
                .map(DatasetVersionEntity::getId)
                .collect(Collectors.toList());
        if (!liveDownstream.isEmpty()) {
            throw new RuntimeException("该版本存在下游依赖版本，无法删除: " + liveDownstream);
        }
    }

    public void softDeleteVersion(Long versionId) {
        assertVersionDeletable(versionId);
        DatasetVersionEntity version = queryVersion(versionId);
        if (version == null) {
            throw new RuntimeException("版本不存在: " + versionId);
        }

        String provenanceType = version.getProvenanceType();
        String storagePath = version.getStoragePath();

        // 1. 根据数据源/生成方式分流执行底层存储资源卸载或删除
        if (ProvenanceType.SOURCE.name().equals(provenanceType)) {
            // SOURCE 类型：卸载底层挂载的外部存储引擎
            try {
                ClusterInfo clusterInfo = iginxSession.getClusterInfo();
                List<StorageEngineInfo> engines = clusterInfo.getStorageEngineInfos();
                if (!CollectionUtils.isEmpty(engines)) {
                    List<RemovedStorageEngineInfo> toRemove = engines.stream()
                            .filter(e -> {
                                String prefix = StringUtils.hasText(e.dataPrefix) ?
                                        e.schemaPrefix + "." + e.dataPrefix : e.schemaPrefix;
                                return storagePath.equals(prefix);
                            })
                            .map(e -> new RemovedStorageEngineInfo(e.ip, e.port, e.schemaPrefix, e.dataPrefix))
                            .collect(Collectors.toList());
                    if (!toRemove.isEmpty()) {
                        iginxSession.removeStorageEngine(toRemove);
                        log.info("已成功卸载 SOURCE 数据源存储引擎: {}", storagePath);
                    }
                }
            } catch (Exception e) {
                log.error("卸载数据源存储引擎失败: {}", storagePath, e);
                throw new RuntimeException("卸载数据源存储引擎失败: " + e.getMessage(), e);
            }
        } else {
            // SELECT / SELECT_UDF / TRANSFORM_SQL 等生成/导入类型：执行 DELETE COLUMNS 语句清理左侧树对应节点与物化数据
            try {
                if (StringUtils.hasText(storagePath)) {
                    String deleteSql = "DELETE COLUMNS " + storagePath + ".*;";
                    log.info("执行清理物化数据/序列SQL: {}", deleteSql);
                    iginxSession.executeSql(deleteSql);
                }
            } catch (Exception e) {
                log.warn("执行 DELETE COLUMNS 清理物化数据异常（尝试通配路径）: {}, err: {}", storagePath, e.getMessage());
                try {
                    String fallbackSql = "DELETE COLUMNS " + storagePath + ";";
                    iginxSession.executeSql(fallbackSql);
                } catch (Exception ex) {
                    log.warn("DELETE COLUMNS 回退执行亦失败: {}", storagePath, ex);
                }
            }
        }

        // 2. 清除权限前缀
        dataPermissionService.deleteByTablePrefix(storagePath);

        // 3. 软删除版本元数据
        version.setDeleted(true);
        version.setId(version.getCreateTime());
        iginxClient.getWriteClient().writeMeasurement(version);
        log.info("数据集版本已软删除。id={}, type={}, storagePath={}", versionId, provenanceType, storagePath);
    }

    /** 软删除逻辑数据集：要求其所有版本均已删除 */
    public void softDeleteDataset(Long datasetId) {
        DatasetInfoEntity dataset = findDatasetById(datasetId);
        if (dataset == null) {
            throw new RuntimeException("数据集不存在: " + datasetId);
        }
        if (!listVersions(datasetId, false).isEmpty()) {
            throw new RuntimeException("数据集仍有未删除的版本，无法删除");
        }
        dataset.setDeleted(true);
        dataset.setId(dataset.getCreateTime());
        iginxClient.getWriteClient().writeMeasurement(dataset);
    }

    // ====================================================================
    // 内部工具
    // ====================================================================

    private <T> List<T> query(String sql, Supplier<T> factory, String prefix) {
        try {
            log.debug(sql);
            SessionExecuteSqlResult res = iginxSession.executeSql(sql);
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);
            return records.stream()
                    .map(record -> ConvertUtil.mapToEntity(factory.get(), record, prefix))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("查询失败: {}", sql, e);
            return new ArrayList<>();
        }
    }

    private long nextId() {
        return ID_SEQUENCE.updateAndGet(previous -> Math.max(previous + 1, System.currentTimeMillis()));
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }

    private static String escape(String s) {
        return s == null ? "" : s.replace("'", "''");
    }
}
