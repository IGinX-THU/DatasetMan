package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.write.Point;
import com.tsinghua.dto.DatasetCreateRequest;
import com.tsinghua.dto.DatasetVersionRegisterRequest;
import com.tsinghua.entity.DataArchiveEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.entity.SqlSnippetEntity;
import com.tsinghua.entity.TransformCompareEntity;
import com.tsinghua.entity.TransformJobEntity;
import com.tsinghua.enums.ProvenanceType;
import com.tsinghua.enums.SchemaPrefix;
import com.tsinghua.util.CommonUtil;
import com.tsinghua.util.ConvertUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.*;

@Service
public class DatasetCreationService {

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    @Autowired
    private SqlSnippetService sqlSnippetService;

    @Autowired
    private DatasetVersionService datasetVersionService;

    @Autowired
    private TransformJobService transformJobService;

    @Autowired
    private TransformCompareService transformCompareService;

    @Autowired
    private DataArchiveService dataArchiveService;

    public DatasetVersionEntity create(DatasetCreateRequest request) throws Exception {
        ProvenanceType type = ProvenanceType.of(request.getProvenanceType());
        DatasetVersionRegisterRequest registration = new DatasetVersionRegisterRequest();
        registration.setDatasetName(request.getDatasetName());
        registration.setProvenanceType(type.name());
        registration.setUpstreamVersionIds(request.getUpstreamVersionIds());
        registration.setDescription(request.getDescription());
        registration.setDataModality(request.getDataModality());
        registration.setProject(request.getProject());
        registration.setRemark(request.getRemark());

        Map<String, Object> config = new LinkedHashMap<>();
        String storagePath;
        if (type == ProvenanceType.SOURCE) {
            if (!StringUtils.hasText(request.getSourcePath())) {
                throw new IllegalArgumentException("请选择数据源");
            }
            storagePath = request.getSourcePath();
            // 快照 DataArchiveEntity 完整 JSON
            DataArchiveEntity archive = dataArchiveService.findByName(request.getSourcePath());
            if (archive != null) {
                config.put("dataArchive", com.alibaba.fastjson2.JSONObject.from(archive));
            }
        } else if (type == ProvenanceType.SQL_QUERY) {
            if (request.getSqlSnippetId() == null) {
                throw new IllegalArgumentException("请选择已托管的 SQL 脚本");
            }
            SqlSnippetEntity snippet = sqlSnippetService.queryById(request.getSqlSnippetId());
            if (snippet == null) {
                throw new IllegalArgumentException("SQL脚本不存在");
            }
            List<String> rawSqlList = sqlSnippetService.getSqlListById(request.getSqlSnippetId());
            if (rawSqlList == null || rawSqlList.isEmpty()) {
                throw new IllegalArgumentException("SQL脚本内容为空");
            }
            // 快照 SqlSnippetEntity 完整 JSON
            config.put("sqlSnippet", com.alibaba.fastjson2.JSONObject.from(snippet));

            if (request.getUdfNames() != null && !request.getUdfNames().isEmpty()) {
                config.put("udfNames", request.getUdfNames());
            }

            storagePath = nextStoragePath(request.getDatasetName());
            MaterializeResult result = materializeSql(rawSqlList, request.getUpstreamVersionIds(), storagePath);
            registration.setRowCount(result.rowCount);
            registration.setSchemaJson(com.alibaba.fastjson2.JSONArray.toJSONString(result.paths));
        } else {
            if (request.getTransformCompareCreateTime() == null) {
                throw new IllegalArgumentException("请选择 Transform 作业");
            }
            TransformCompareEntity compare = transformCompareService.queryJob(request.getTransformCompareCreateTime());
            if (compare == null) {
                throw new IllegalArgumentException("Transform作业不存在");
            }
            // 快照 TransformCompareEntity 完整 JSON
            config.put("transformCompare", com.alibaba.fastjson2.JSONObject.from(compare));

            // 提交执行，快照执行后的 TransformJobEntity
            TransformJobEntity job = transformJobService.commitJob(request.getTransformCompareCreateTime());
            storagePath = resolveTransformOutputPath(job);
            config.put("transformJob", com.alibaba.fastjson2.JSONObject.from(job));
        }

        registration.setStoragePath(storagePath);
        registration.setDerivationConfig(config);
        return datasetVersionService.registerVersion(registration);
    }

    private MaterializeResult materializeSql(List<String> sqlList, List<Long> upstreamIds, String storagePath) throws Exception {
        if (sqlList == null || sqlList.isEmpty()) {
            throw new IllegalArgumentException("SQL语句列表为空");
        }
        String upstreamPath = firstUpstreamPath(upstreamIds);
        List<Point> points = new ArrayList<>();
        Set<String> paths = new LinkedHashSet<>();
        long rowCount = 0;
        long keyBase = System.currentTimeMillis();

        for (int queryIndex = 0; queryIndex < sqlList.size(); queryIndex++) {
            String rawSql = sqlList.get(queryIndex);
            if (!StringUtils.hasText(rawSql)) continue;
            String sql = bindSql(rawSql.trim(), upstreamPath, storagePath);
            CommonUtil.validateSql(sql);
            SessionExecuteSqlResult result = iginxSession.executeSql(sql);
            List<Map<String, Object>> records = ConvertUtil.getRecords(result);
            long rowOffset = rowCount;
            for (int rowIndex = 0; rowIndex < records.size(); rowIndex++) {
                for (Map.Entry<String, Object> entry : records.get(rowIndex).entrySet()) {
                    String field = "q" + queryIndex + "." + normalizePath(entry.getKey());
                    Point point = ConvertUtil.createFieldPoint(storagePath, field, entry.getValue(), keyBase + rowOffset + rowIndex);
                    if (point != null) {
                        points.add(point);
                        paths.add(storagePath + "." + field);
                    }
                }
            }
            rowCount += records.size();
        }
        if (points.isEmpty()) {
            throw new IllegalArgumentException("SQL执行结果为空，未创建数据集版本");
        }
        iginxClient.getWriteClient().writePoints(points);
        return new MaterializeResult(rowCount, new ArrayList<>(paths));
    }

    private String firstUpstreamPath(List<Long> upstreamIds) {
        if (upstreamIds == null || upstreamIds.isEmpty()) {
            return "";
        }
        DatasetVersionEntity upstream = datasetVersionService.queryVersion(upstreamIds.get(0));
        if (upstream == null) {
            throw new IllegalArgumentException("上游数据集版本不存在: " + upstreamIds.get(0));
        }
        return upstream.getStoragePath();
    }

    private String bindSql(String sql, String upstreamPath, String targetPath) {
        return sql.replace("${upstream}", upstreamPath)
                .replace("{upstream}", upstreamPath)
                .replace("${target}", targetPath)
                .replace("{target}", targetPath);
    }

    private String nextStoragePath(String datasetName) {
        long now = System.currentTimeMillis();
        String safeName = normalizePath(datasetName).replace('.', '_');
        return SchemaPrefix.DATASET_PREFIX + "." + safeName + "." + CommonUtil.generateVersion(now);
    }

    private String resolveTransformOutputPath(TransformJobEntity job) {
        if (job.getExportType() == 1 && StringUtils.hasText(job.getExportFiletName())) {
            String file = job.getExportFiletName().replace('\\', '/');
            file = file.substring(file.lastIndexOf('/') + 1);
            return "file_system.sys_data.job." + file;
        }
        throw new IllegalArgumentException("该Transform任务没有可识别的物化输出路径，请填写输出路径");
    }

    private String normalizePath(String path) {
        if (path == null || path.isEmpty()) return "value";
        return path.replaceAll("[^a-zA-Z0-9_\\u4e00-\\u9fa5.]", "_")
                .replaceAll("\\.{2,}", ".")
                .replaceAll("^\\.|\\.$", "");
    }

    private static class MaterializeResult {
        private final long rowCount;
        private final List<String> paths;

        private MaterializeResult(long rowCount, List<String> paths) {
            this.rowCount = rowCount;
            this.paths = paths;
        }
    }
}
