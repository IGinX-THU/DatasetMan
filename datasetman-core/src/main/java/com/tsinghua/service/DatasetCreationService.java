package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import cn.edu.tsinghua.iginx.session_v2.write.Point;
import com.tsinghua.dto.DatasetCreateRequest;
import com.tsinghua.dto.DatasetPathPreviewDTO;
import com.tsinghua.dto.DatasetVersionRegisterRequest;
import com.tsinghua.dto.DataImportRequest;
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
import java.nio.file.Files;
import java.nio.file.Path;

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

    @Autowired
    private DataTableService dataTableService;

    public DatasetPathPreviewDTO preview(DatasetCreateRequest request) {
        ProvenanceType type = ProvenanceType.of(request.getProvenanceType());
        DatasetPathPreviewDTO result = new DatasetPathPreviewDTO();
        result.setDatasetName(request.getDatasetName());
        result.setProvenanceType(type.name());
        result.setVersionNo(CommonUtil.generateVersion(System.currentTimeMillis()));
        if (type == ProvenanceType.SOURCE) {
            if (!StringUtils.hasText(request.getSourcePath())) {
                throw new IllegalArgumentException("请选择数据源");
            }
            result.setStoragePath(request.getSourcePath());
        } else if (type == ProvenanceType.TRANSFORM) {
            if (request.getTransformCompareCreateTime() == null) {
                throw new IllegalArgumentException("请选择 Transform 作业");
            }
            TransformCompareEntity compare = transformCompareService.queryJob(request.getTransformCompareCreateTime());
            if (compare == null) {
                throw new IllegalArgumentException("Transform作业不存在");
            }
            result.setStoragePath(resolveTransformCompareOutputPath(compare));
        } else {
            result.setStoragePath(nextStoragePath(request.getDatasetName(), result.getVersionNo()));
        }
        return result;
    }

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
        registration.setTags(request.getTags());

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
        } else if (type == ProvenanceType.IMPORT) {
            // 导入 CSV 文件数据为数据集
            if (!StringUtils.hasText(request.getImportFileBase64())) {
                throw new IllegalArgumentException("请上传导入文件");
            }
            storagePath = nextStoragePath(request.getDatasetName(), request.getVersionNo());
            // 解码 Base64 文件内容，写入临时文件，调用 DataTableService.importCsvFile
            byte[] fileBytes = Base64.getDecoder().decode(request.getImportFileBase64());
            Path tempFile = Files.createTempFile("dataset_import_", ".csv");
            try {
                Files.write(tempFile, fileBytes);
                String uploadedFileName = System.currentTimeMillis() + ".csv";
                Long rowCount = dataTableService.importCsvFile(tempFile, storagePath, uploadedFileName,
                        com.tsinghua.auth.util.AuthUtil.getCurrentUsername(), request.getImportKeyColumn());
                registration.setRowCount(rowCount);
                config.put("importFileName", request.getImportFileName() != null ? request.getImportFileName() : uploadedFileName);
                config.put("importRowCount", rowCount);
                if (request.getImportKeyColumn() != null && !request.getImportKeyColumn().trim().isEmpty()) {
                    config.put("importKeyColumn", request.getImportKeyColumn());
                }
            } finally {
                Files.deleteIfExists(tempFile);
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

            storagePath = nextStoragePath(request.getDatasetName(), request.getVersionNo());
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
            registration.setJobState(job.getJobState());
        }

        registration.setStoragePath(storagePath);
        // 存储路径形如 datasets.<name>.v_yymmdd_hhmmss 时，复用其后缀作为版本号，避免版本号与路径不一致
        int lastDot = storagePath.lastIndexOf('.');
        if (lastDot >= 0 && storagePath.substring(lastDot + 1).matches("v_\\d{6}_\\d{6}")) {
            registration.setVersionNo(storagePath.substring(lastDot + 1));
        }
        registration.setDerivationConfig(config);
        return datasetVersionService.registerVersion(registration);
    }

    /** 单批写入的数据点上限，防止大结果集一次性写入撑爆堆内存 */
    private static final int WRITE_BATCH_POINTS = 5000;

    private MaterializeResult materializeSql(List<String> sqlList, List<Long> upstreamIds, String storagePath) throws Exception {
        if (sqlList == null || sqlList.isEmpty()) {
            throw new IllegalArgumentException("SQL语句列表为空");
        }
        String upstreamPath = firstUpstreamPath(upstreamIds);
        Set<String> paths = new LinkedHashSet<>();
        Map<String, Integer> usedFields = new HashMap<>();
        long rowCount = 0;
        long keyBase = System.currentTimeMillis();

        WriteClient writeClient = iginxClient.getWriteClient();
        List<Point> batch = new ArrayList<>();

        for (int queryIndex = 0; queryIndex < sqlList.size(); queryIndex++) {
            String rawSql = sqlList.get(queryIndex);
            if (!StringUtils.hasText(rawSql)) continue;
            String sql = bindSql(rawSql.trim(), upstreamPath, storagePath);
            CommonUtil.validateSql(sql);
            SessionExecuteSqlResult result = iginxSession.executeSql(sql);
            List<String> outPaths = result.getPaths();
            List<List<Object>> rows = result.getValues();

            // 列名只保留原输出路径的最后一级（叶子），按路径一次性分配，重名自动加序号
            String[] fields = new String[outPaths.size()];
            for (int i = 0; i < outPaths.size(); i++) {
                String base = normalizePath(outPaths.get(i).substring(outPaths.get(i).lastIndexOf('.') + 1));
                if (base.isEmpty()) base = "value";
                String field = base;
                Integer seen = usedFields.get(base);
                int seq = seen == null ? 0 : seen;
                while (paths.contains(storagePath + "." + field)) {
                    seq += 1;
                    field = base + "_" + seq;
                }
                usedFields.put(base, seq);
                fields[i] = field;
            }

            long rowOffset = rowCount;
            for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
                List<Object> row = rows.get(rowIndex);
                long key = keyBase + rowOffset + rowIndex;
                for (int i = 0; i < outPaths.size(); i++) {
                    if (i >= row.size()) break;
                    Object value = row.get(i);
                    if (value == null) continue;
                    if (value instanceof byte[]) {
                        value = ConvertUtil.bytesToString((byte[]) value);
                    }
                    Point point = ConvertUtil.createFieldPoint(storagePath, fields[i], value, key);
                    if (point != null) {
                        batch.add(point);
                        paths.add(storagePath + "." + fields[i]);
                    }
                }
                if (batch.size() >= WRITE_BATCH_POINTS) {
                    writeClient.writePoints(batch);  // 分批写入，避免全量堆积导致 OOM
                    batch = new ArrayList<>();
                }
            }
            rowCount += rows.size();
        }
        if (!batch.isEmpty()) {
            writeClient.writePoints(batch);
        }
        if (paths.isEmpty()) {
            throw new IllegalArgumentException("SQL执行结果为空，未创建数据集版本");
        }
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

    private String nextStoragePath(String datasetName, String plannedVersionNo) {
        long now = System.currentTimeMillis();
        String safeName = normalizePath(datasetName).replace('.', '_');
        // 前端预览时规划的版本号优先复用，保证预览存储路径与实际创建一致
        if (plannedVersionNo != null && plannedVersionNo.matches("v_\\d{6}_\\d{6}")) {
            return SchemaPrefix.DATASET_PREFIX + "." + safeName + "." + plannedVersionNo;
        }
        return SchemaPrefix.DATASET_PREFIX + "." + safeName + "." + CommonUtil.generateVersion(now);
    }

    private String resolveTransformOutputPath(TransformJobEntity job) {
        return buildTransformOutputPath(job.getExportType(), job.getExportFiletName());
    }

    private String resolveTransformCompareOutputPath(TransformCompareEntity compare) {
        return buildTransformOutputPath(compare.getExportType(), compare.getExportFile());
    }

    static String buildTransformOutputPath(Integer exportType, String exportFile) {
        // exportType: 0=none, 1=file, 2=IGinX
        if (exportType != null && exportType == 1 && StringUtils.hasText(exportFile)) {
            String file = exportFile.replace('\\', '/');
            file = file.substring(file.lastIndexOf('/') + 1);
            // 文件名中的 '.' 在 IGinX schema 路径中是层级分隔符，需转义为 '\'
            file = file.replace(".", "\\");
            return "file_system.sys_data.job." + file;
        }
        // IGinX 输出固定写入 transform 路径
        return "transform";
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
