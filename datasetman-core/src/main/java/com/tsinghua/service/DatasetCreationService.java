package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.write.Point;
import com.tsinghua.dto.DatasetCreateRequest;
import com.tsinghua.dto.DatasetVersionRegisterRequest;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.entity.SqlSnippetEntity;
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
            config.put("tablePrefix", request.getSourcePath());
        } else if (type == ProvenanceType.SELECT || type == ProvenanceType.SELECT_UDF) {
            if (request.getSqlSnippetId() == null) {
                throw new IllegalArgumentException("请选择SQL片段");
            }
            SqlSnippetEntity snippet = sqlSnippetService.queryById(request.getSqlSnippetId());
            if (snippet == null) {
                throw new IllegalArgumentException("SQL片段不存在");
            }
            storagePath = nextStoragePath(request.getDatasetName());
            MaterializeResult result = materializeSql(snippet, request.getUpstreamVersionIds(), storagePath);
            config.put("sqlSnippetId", request.getSqlSnippetId());
            config.put("sqlSnippetName", snippet.getName());
            if (type == ProvenanceType.SELECT_UDF) {
                config.put("udfNames", request.getUdfNames() == null ? Collections.emptyList() : request.getUdfNames());
            }
            registration.setRowCount(result.rowCount);
            registration.setSchemaJson(com.alibaba.fastjson2.JSONArray.toJSONString(result.paths));
        } else {
            if (!StringUtils.hasText(request.getTransformJobId())) {
                throw new IllegalArgumentException("请选择Transform任务");
            }
            TransformJobEntity job = transformJobService.queryJob(request.getTransformJobId());
            if (job == null) {
                throw new IllegalArgumentException("Transform任务不存在");
            }
            if (job.getJobState() != 1) {
                throw new IllegalArgumentException("只能使用已完成的Transform任务创建数据集版本");
            }
            storagePath = StringUtils.hasText(request.getTransformOutputPath())
                    ? request.getTransformOutputPath() : resolveTransformOutputPath(job);
            config.put("transformJobId", request.getTransformJobId());
            config.put("transformJobName", job.getName());
            config.put("exportType", job.getExportType());
            config.put("exportFile", job.getExportFiletName());
        }

        registration.setStoragePath(storagePath);
        registration.setDerivationConfig(config);
        return datasetVersionService.registerVersion(registration);
    }

    private MaterializeResult materializeSql(SqlSnippetEntity snippet, List<Long> upstreamIds, String storagePath) throws Exception {
        List<String> sqlList = sqlSnippetService.getSqlListById(snippet.getId());
        String upstreamPath = firstUpstreamPath(upstreamIds);
        List<Point> points = new ArrayList<>();
        Set<String> paths = new LinkedHashSet<>();
        long rowCount = 0;
        long keyBase = System.currentTimeMillis();

        for (int queryIndex = 0; queryIndex < sqlList.size(); queryIndex++) {
            String sql = bindSql(sqlList.get(queryIndex), upstreamPath, storagePath);
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
