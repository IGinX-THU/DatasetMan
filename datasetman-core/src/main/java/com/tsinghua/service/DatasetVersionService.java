package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import cn.edu.tsinghua.iginx.session_v2.DeleteClient;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.service.DataPermissionService;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.DatasetTreeDTO;
import com.tsinghua.dto.DatasetVersionRegisterRequest;
import com.tsinghua.entity.DatasetLineageEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.entity.TransformJobEntity;
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

    public static final String VERSION_PREFIX = "relational_system.dataset_version";
    public static final String LINEAGE_PREFIX = "relational_system.dataset_lineage";
    private static final AtomicLong ID_SEQUENCE = new AtomicLong(System.currentTimeMillis());

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    @Autowired
    private DataPermissionService dataPermissionService;

    @Autowired
    private TransformJobService transformJobService;

    // ====================================================================
    // 登记
    // ====================================================================

    /**
     * 登记一个数据集版本：直接写版本 → 写血缘边 → 登记数据权限前缀
     */
    public DatasetVersionEntity registerVersion(DatasetVersionRegisterRequest request) {
        ProvenanceType type = ProvenanceType.of(request.getProvenanceType());

        long timestamp = nextId();
        String operator = OperationLogAspect.getCurrentUser();
        String clientIp = OperationLogAspect.getClientIp();

        // 默认主上游 = 本数据集最新版本（SOURCE 类型除外）
        List<Long> upstreams = request.getUpstreamVersionIds() == null
                ? new ArrayList<>() : new ArrayList<>(request.getUpstreamVersionIds());
        if (upstreams.isEmpty() && type != ProvenanceType.SOURCE) {
            DatasetVersionEntity latest = latestVersion(request.getDatasetName());
            if (latest != null) {
                upstreams.add(latest.getId());
            }
        }

        DatasetVersionEntity version = new DatasetVersionEntity();
        version.setDatasetName(request.getDatasetName());
        // 优先复用调用方指定的版本号（如创建向导从存储路径提取），保证版本号与存储路径后缀一致
        String versionNo = StringUtils.hasText(request.getVersionNo())
                ? request.getVersionNo() : CommonUtil.generateVersion(timestamp);
        version.setVersionNo(versionNo);
        
        // 如果版本号是 v_yymmdd_hhmmss 格式，解析时间戳用于 id 和 createTime，避免版本号与存储路径不一致
        long effectiveTimestamp = timestamp;
        if (versionNo.matches("v_\\d{6}_\\d{6}")) {
            effectiveTimestamp = CommonUtil.parseVersionTimestamp(versionNo);
        }
        version.setId(effectiveTimestamp);
        version.setProvenanceType(type.name());
        version.setStoragePath(request.getStoragePath());
        version.setUpstreamVersionIds(JSONArray.toJSONString(upstreams));
        version.setDerivationConfig(request.getDerivationConfig() == null
                ? "{}" : JSONObject.toJSONString(request.getDerivationConfig()));
        version.setSchemaJson(nvl(request.getSchemaJson()));
        version.setRowCount(request.getRowCount() == null ? 0L : request.getRowCount());
        version.setSizeBytes(request.getSizeBytes() == null ? 0L : request.getSizeBytes());
        version.setCreateTime(effectiveTimestamp);
        version.setOperator(operator);
        version.setClientIp(clientIp);
        version.setRemark(nvl(request.getRemark()));
        version.setDataModality(request.getDataModality() != null ? request.getDataModality() : "relational");
        version.setTags(nvl(request.getTags()));
        version.setDescription(nvl(request.getDescription()));
        version.setProject(StringUtils.hasText(request.getProject()) ? request.getProject() : "default");
        version.setOwner(AuthUtil.getCurrentUsername());
        version.setDeleted(false);
        version.setJobState(request.getJobState() != null ? request.getJobState() : -1);

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(version);

        // 血缘边：首个上游为主上游
        for (int i = 0; i < upstreams.size(); i++) {
            long edgeTs = nextId();
            DatasetLineageEntity edge = new DatasetLineageEntity();
            edge.setId(edgeTs);
            edge.setFromVersionId(upstreams.get(i));
            // 必须指向版本最终生效的ID（可能来自版本号解析），与节点ID保持一致，否则血缘图无法连线
            edge.setToVersionId(version.getId());
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
                request.getDatasetName(), version.getVersionNo(), type, request.getStoragePath());
        return version;
    }

    // ====================================================================
    // 查询：版本
    // ====================================================================

    /** 最终状态：FINISHED(1), PARTIALLY_FAILED(6), FAILED(8), CLOSED(10) */
    private static boolean isFinalJobState(Integer jobState) {
        if (jobState == null || jobState < 0) return true;
        return jobState == 1 || jobState == 6 || jobState == 8 || jobState == 10;
    }

    /**
     * 刷新 TRANSFORM 类型版本关联的 Transform 作业状态。
     * 对未到最终状态的版本，调用 statusJob 刷新并回写 jobState。
     */
    public void refreshTransformJobStates(List<DatasetVersionEntity> versions) {
        if (versions == null || versions.isEmpty()) return;
        for (DatasetVersionEntity v : versions) {
            if (!ProvenanceType.TRANSFORM.name().equals(v.getProvenanceType())) continue;
            if (isFinalJobState(v.getJobState())) continue;
            try {
                String jobId = extractTransformJobId(v);
                if (jobId == null) continue;
                TransformJobEntity job = transformJobService.statusJob(jobId);
                if (job != null && job.getJobState() != v.getJobState()) {
                    v.setJobState(job.getJobState());
                    v.setId(v.getCreateTime());
                    iginxClient.getWriteClient().writeMeasurement(v);
                    log.info("已刷新版本 {} 的 Transform 作业状态为 {}", v.getId(), job.getJobState());
                }
            } catch (Exception e) {
                log.warn("刷新版本 {} 的 Transform 作业状态失败: {}", v.getId(), e.getMessage());
            }
        }
    }

    private String extractTransformJobId(DatasetVersionEntity version) {
        if (version.getDerivationConfig() == null) return null;
        try {
            JSONObject config = JSONObject.parse(version.getDerivationConfig());
            JSONObject job = config.getJSONObject("transformJob");
            if (job != null) return job.getString("jobId");
        } catch (Exception e) {
            log.warn("解析 derivationConfig 获取 jobId 失败: {}", e.getMessage());
        }
        return null;
    }

    // ====================================================================
    // 查询：版本
    // ====================================================================

    public DatasetVersionEntity queryVersion(Long versionId) {
        String sql = String.format("select * from %s where createTime = %d;", VERSION_PREFIX, versionId);
        return query(sql, DatasetVersionEntity::new, VERSION_PREFIX).stream()
                .findFirst().orElse(null);
    }

    /** 按数据集名称 + 版本号精确查询 */
    public DatasetVersionEntity queryVersionByNameAndNo(String datasetName, String versionNo) {
        String sql = String.format("select * from %s where datasetName = '%s' and versionNo = '%s';",
                VERSION_PREFIX, escape(datasetName), escape(versionNo));
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
    public List<DatasetVersionEntity> listVersions(String datasetName, boolean includeDeleted) {
        String sql;
        if (StringUtils.hasText(datasetName)) {
            sql = String.format("select * from %s where datasetName = '%s';", VERSION_PREFIX, escape(datasetName));
        } else {
            return new ArrayList<>();
        }
        List<DatasetVersionEntity> versions = query(sql, DatasetVersionEntity::new, VERSION_PREFIX);
        refreshTransformJobStates(versions);
        return versions.stream()
                .filter(v -> includeDeleted || !v.isDeleted())
                .sorted(Comparator.comparing(DatasetVersionEntity::getCreateTime).reversed())
                .collect(Collectors.toList());
    }

    public DatasetVersionEntity latestVersion(String datasetName) {
        List<DatasetVersionEntity> versions = listVersions(datasetName, false);
        return versions.isEmpty() ? null : versions.get(0);
    }

    /** 全部未删除版本，并按当前用户数据权限过滤（供右侧树使用） */
    public List<DatasetVersionEntity> listAllAccessibleVersions() {
        String sql = String.format("select * from %s;", VERSION_PREFIX);
        List<DatasetVersionEntity> all = query(sql, DatasetVersionEntity::new, VERSION_PREFIX).stream()
                .filter(v -> !v.isDeleted())
                .collect(Collectors.toList());
        refreshTransformJobStates(all);
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
        Map<String, DatasetTreeDTO> groups = new LinkedHashMap<>();
        listAllAccessibleVersions().stream()
                .sorted(Comparator.comparing(DatasetVersionEntity::getDatasetName, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(DatasetVersionEntity::getCreateTime, Comparator.nullsLast(Comparator.naturalOrder())))
                .forEach(v -> {
                    DatasetTreeDTO dataset = groups.computeIfAbsent(v.getDatasetName(), name -> {
                        DatasetTreeDTO dto = new DatasetTreeDTO();
                        dto.setDatasetName(name);
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
                    version.setJobState(v.getJobState());
                    version.setDataModality(v.getDataModality());
                    version.setRowCount(v.getRowCount());
                    dataset.getVersions().add(version);
                });
        return new ArrayList<>(groups.values());
    }

    // ====================================================================
    // 查询：数据集管理列表（分页，含已禁用版本）
    // ====================================================================

    /**
     * 分页查询数据集版本列表（供数据集管理列表页）。
     * 与树接口解耦：支持名称模糊、数据类型过滤，不因禁用状态过滤。
     */
    public List<DatasetVersionEntity> queryVersionPage(com.tsinghua.dto.DatasetListQueryRequest request) {
        StringBuilder sql = new StringBuilder("SELECT * FROM ").append(VERSION_PREFIX).append(" WHERE 1=1");
        sql.append(buildListFilters(request));
        sql.append(" ORDER BY createTime DESC")
           .append(" LIMIT ").append(request.getPageSize())
           .append(" OFFSET ").append((request.getPageNum() - 1) * request.getPageSize())
           .append(";");
        return queryVersionList(sql.toString());
    }

    /** 分页总数 */
    public long countVersionPage(com.tsinghua.dto.DatasetListQueryRequest request) {
        try {
            StringBuilder sql = new StringBuilder("SELECT COUNT(1) FROM ").append(VERSION_PREFIX).append(" WHERE 1=1");
            sql.append(buildListFilters(request)).append(";");
            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            Object v = res.getValues().get(0).get(0);
            return v == null ? 0 : Long.parseLong(v.toString());
        } catch (Exception e) {
            log.error("统计数据集版本总数失败", e);
            return 0;
        }
    }

    private String buildListFilters(com.tsinghua.dto.DatasetListQueryRequest request) {
        StringBuilder sb = new StringBuilder();
        if (request.getDatasetName() != null && !request.getDatasetName().trim().isEmpty()) {
            sb.append(" AND datasetName LIKE '^.*").append(escape(request.getDatasetName().trim())).append(".*'");
        }
        if (request.getDataModality() != null && !request.getDataModality().trim().isEmpty()) {
            sb.append(" AND dataModality = '").append(escape(request.getDataModality().trim())).append("'");
        }
        if (request.getProvenanceType() != null && !request.getProvenanceType().trim().isEmpty()) {
            sb.append(" AND provenanceType = '").append(escape(request.getProvenanceType().trim())).append("'");
        }
        return sb.toString();
    }

    private List<DatasetVersionEntity> queryVersionList(String sql) {
        List<DatasetVersionEntity> result = new ArrayList<>();
        try {
            SessionExecuteSqlResult res = iginxSession.executeSql(sql);
            for (Map<String, Object> record : ConvertUtil.getRecords(res)) {
                result.add(ConvertUtil.mapToEntity(new DatasetVersionEntity(), record, VERSION_PREFIX));
            }
        } catch (Exception e) {
            log.error("查询数据集版本列表失败: {}", sql, e);
        }
        return result;
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
        DatasetVersionEntity version = queryVersion(versionId);
        if (version == null) {
            throw new RuntimeException("版本不存在: " + versionId);
        }

        // 仅做数据集档案的逻辑删除，不删除对应数据源和数据
        version.setDeleted(true);
        version.setId(version.getCreateTime());
        iginxClient.getWriteClient().writeMeasurement(version);
        log.info("数据集版本已软删除。id={}, type={}, storagePath={}", versionId, version.getProvenanceType(), version.getStoragePath());
    }

    /** 启用/禁用版本（仅切换 deleted 标记，不删除权限） */
    public boolean toggleVersion(Long versionId) {
        DatasetVersionEntity version = queryVersion(versionId);
        if (version == null) {
            throw new RuntimeException("版本不存在: " + versionId);
        }
        boolean newState = !version.isDeleted();
        version.setDeleted(newState);
        version.setId(version.getCreateTime());
        iginxClient.getWriteClient().writeMeasurement(version);
        log.info("数据集版本已{}。id={}", newState ? "禁用" : "启用", versionId);
        return newState;
    }

    /** 更新数据集版本档案（备注、数据类型、场景分类、标签可编辑） */
    public void updateVersion(Long versionId, String remark, String dataModality) {
        updateVersion(versionId, remark, dataModality, null, null);
    }

    public void updateVersion(Long versionId, String remark, String dataModality, String category, String tags) {
        DatasetVersionEntity version = queryVersion(versionId);
        if (version == null) {
            throw new RuntimeException("版本不存在: " + versionId);
        }
        if (remark != null) version.setRemark(remark);
        if (dataModality != null) version.setDataModality(dataModality);
        if (tags != null) version.setTags(tags);
        version.setId(version.getCreateTime());
        iginxClient.getWriteClient().writeMeasurement(version);
        log.info("数据集版本档案已更新。id={}", versionId);
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
