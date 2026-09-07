package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.TransformClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import cn.edu.tsinghua.iginx.thrift.*;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.DatasetVersionRegisterRequest;
import com.tsinghua.dto.TaskInfoBo;
import com.tsinghua.dto.TaskInfoDto;
import com.tsinghua.dto.TransformJobQueryRequest;
import com.tsinghua.dto.request.FilesystemStorageRequest;
import com.tsinghua.entity.DatasetEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.entity.SqlSnippetEntity;
import com.tsinghua.entity.TransformCompareEntity;
import com.tsinghua.entity.TransformJobEntity;
import com.tsinghua.enums.SchemaPrefix;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TransformJobService {

    private static final String DATA_PREFIX = "relational_system.transform_job";
    private static final String JOB_OUTPUT = "job";

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    @Autowired
    private DatasetService datasetService;

    @Autowired
    private TransformCompareService transformCompareService;

    @Autowired
    private DataSourceService dataSourceService;

    @Autowired
    private SqlSnippetService sqlSnippetService;

    @Autowired
    private DatasetVersionService datasetVersionService;

    @Value("${iginx.ip}")
    private String ip;

    @Value("${iginx.port}")
    private int port;

    @PostConstruct
    private void init() {
        try {
            // 创建函数目录
            Path pathDir = Paths.get(SchemaPrefix.SYS_DIR_PREFIX, JOB_OUTPUT);
            if (!Files.exists(pathDir)) {
                Files.createDirectories(pathDir);
                log.info("创建任务输出目录: {}", pathDir);
            }
            FilesystemStorageRequest request = new FilesystemStorageRequest();
            request.setIp(ip);
            request.setIginxPort(port);
            request.setStorageEngineType(3);
            request.setHasData(true);
            request.setIsReadOnly(true);
            request.setSchemaPrefix(SchemaPrefix.FILE_SYSTEM);
            request.setDataPrefix(SchemaPrefix.SYS_DIR_PREFIX);
            request.setDescription(SchemaPrefix.FILE_SYSTEM);
            request.setPort(6666);
            request.setDummyDir(Paths.get(SchemaPrefix.SYS_DIR_PREFIX).toAbsolutePath().toString());
            dataSourceService.registerDataSource(request);
        } catch (Exception e) {
            log.error(e.getMessage());
        }

    }

    public TransformJobEntity saveTransform(TransformJobEntity transformJobEntity) {

        long timestamp;
        if (transformJobEntity.getId() != null){
            timestamp = transformJobEntity.getId();
        } else if (transformJobEntity.getCreateTime() != null){
            timestamp = transformJobEntity.getCreateTime();
        } else {
            timestamp = System.currentTimeMillis();
        }

        // 获取操作人
        String operator = OperationLogAspect.getCurrentUser();

        // 获取IP地址
        String clientIp = OperationLogAspect.getClientIp();

        transformJobEntity.setId(timestamp);
        transformJobEntity.setCreateTime(timestamp);
        transformJobEntity.setOperator(operator);
        transformJobEntity.setClientIp(clientIp);
        transformJobEntity.setOwner(AuthUtil.getCurrentUsername());

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(transformJobEntity);

        log.info("Transform作业已保存。名称: {}, 时间戳: {}", transformJobEntity.getName(), timestamp);

        return transformJobEntity;
    }

    public List<TransformJobEntity> queryJobs(TransformJobQueryRequest request) {
        try {
            // 构建基础SQL
            StringBuilder sql = new StringBuilder("SELECT * FROM relational_system.transform_job WHERE 1=1");

            // 添加owner过滤
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql.append(" AND owner = '").append(currentUser).append("'");
            }

            // 添加筛选条件
            if (request.getName() != null && !request.getName().trim().isEmpty()) {
                sql.append(" AND name LIKE '^.*").append(request.getName().trim()).append(".*'");
            }
            
            if (request.getJobState() != null) {
                sql.append(" AND jobState = ").append(request.getJobState());
            }
            
            // 添加排序和分页
            sql.append(" ORDER BY createTime DESC");
            sql.append(" LIMIT ").append(request.getPageSize());
            sql.append(" OFFSET ").append((request.getPageNum() - 1) * request.getPageSize());
            sql.append(";");
            
            log.info("执行SQL: {}", sql);
            
            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);
            
            // 转换为TransformJobEntity列表
            List<TransformJobEntity> result = records.stream().map(record -> {
                TransformJobEntity entity = new TransformJobEntity();
                record.forEach((k, v) -> {
                    String fieldName = k.replace(DATA_PREFIX + ".", "");
                    ConvertUtil.setEntityField(entity, DATA_PREFIX, fieldName, v);
                });
                return entity;
            }).collect(Collectors.toList());
            
            log.info("查询结果: records={}", result.size());
            return result;
        } catch (Exception e) {
            log.error("查询失败", e);
            return new ArrayList<>();
        }
    }

    public Object countJobs(TransformJobQueryRequest request) {
        try {
            // 构建COUNT查询SQL
            StringBuilder sql = new StringBuilder("SELECT COUNT(1) FROM relational_system.transform_job WHERE 1=1");

            // 添加owner过滤
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql.append(" AND owner = '").append(currentUser).append("'");
            }

            // 添加筛选条件
            if (request.getName() != null && !request.getName().trim().isEmpty()) {
                sql.append(" AND name LIKE '%").append(request.getName().trim()).append("%'");
            }
            
            if (request.getJobState() != null) {
                sql.append(" AND jobState = ").append(request.getJobState());
            }
            
            sql.append(";");
            
            log.info("执行COUNT SQL: {}", sql);
            
            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            
            return res.getValues().get(0).get(0);
        } catch (Exception e) {
            log.error("查询失败", e);
            return 0;
        }
    }

    public TransformJobEntity queryJob(String jobId) {
        try {
            String sql = "select * from %s where jobId = '%s'";
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                if (! "unknown".equals(currentUser)) {
                    sql += " AND owner = '" + currentUser + "'";
                }
            }
            sql += ";";
            String sqlFormat= String.format(sql, DATA_PREFIX, jobId);
            log.info("执行SQL: {}", sqlFormat);
            SessionExecuteSqlResult res = iginxSession.executeSql(sqlFormat);
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            if (records.isEmpty()) {
                return null;
            }

            TransformJobEntity entity = new TransformJobEntity();
            Map<String, Object> rs = records.get(0);
            rs.forEach((k, v) -> {
                String fieldName = k.replace(DATA_PREFIX + ".", "");
                ConvertUtil.setEntityField(entity, DATA_PREFIX, fieldName, v);
            });
            return entity;
        } catch (Exception e) {
            log.error("查询Transform作业失败", e);
            return null;
        }
    }

    public void deleteJob(Long createTime) {
        try {
            // 检查权限
            TransformJobEntity entity = queryJobByCreateTime(createTime);
            if (entity == null) {
                throw new RuntimeException("作业不存在或无权删除");
            }

            List<String> measurements = ConvertUtil.iginxFieldNamesConvert(TransformJobEntity.class, DATA_PREFIX);
            iginxClient.getDeleteClient().deleteMeasurementsData(measurements, createTime - 1, createTime + 1);
            log.info("已删除Transform作业: createTime: {}", createTime);
        } catch (Exception e) {
            log.error("删除Transform作业失败", e);
            throw new RuntimeException("删除Transform作业失败: " + e.getMessage(), e);
        }
    }

    public TransformJobEntity queryJobByCreateTime(Long createTime) {
        try {
            String sql = "select * from %s where createTime = %s";
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql += " AND owner = '" + currentUser + "'";
            }
            sql += ";";
            SessionExecuteSqlResult res = iginxSession.executeSql(String.format(sql, DATA_PREFIX, createTime));
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            if (records.isEmpty()) {
                return null;
            }

            TransformJobEntity entity = new TransformJobEntity();
            Map<String, Object> rs = records.get(0);
            rs.forEach((k, v) -> {
                String fieldName = k.replace(DATA_PREFIX + ".", "");
                ConvertUtil.setEntityField(entity, DATA_PREFIX, fieldName, v);
            });
            return entity;
        } catch (Exception e) {
            log.error("查询Transform作业失败", e);
            return null;
        }
    }

    public TransformJobEntity commitJob(Long createTime) throws Exception {

        TransformCompareEntity transformCompare = transformCompareService.queryJob(createTime);
        if (transformCompare == null) {
            throw new RuntimeException("未找到指定的作业");
        }

        List<TaskInfoDto> taskList = JSONArray.parseArray(transformCompare.getTaskList(), TaskInfoDto.class);
        List<TaskInfoBo> taskInfoBoList = new ArrayList<>();

        // 构造任务
        List<TaskInfo> taskInfoList = new ArrayList<>();

        for (TaskInfoDto taskInfoDto : taskList) {
            TaskType taskType = TaskType.findByValue(taskInfoDto.getTaskType());
            DataFlowType dataFlowType = DataFlowType.findByValue(taskInfoDto.getDataFlowType());
            TaskInfoBo taskInfoBo = new TaskInfoBo();
            taskInfoBo.setTaskType(taskType.name());
            taskInfoBo.setDataFlowType(dataFlowType.name());

            TaskInfo taskInfo = new TaskInfo(taskType, dataFlowType);

            if (taskType == TaskType.IGINX) {
                List<String> sqlList;
                // 优先使用sqlSnippetId引用SQL片段（新方式）
                if (taskInfoDto.getSqlSnippetId() != null) {
                    SqlSnippetEntity sqlSnippetEntity = sqlSnippetService.queryById(taskInfoDto.getSqlSnippetId());
                    if (sqlSnippetEntity == null) {
                        throw new RuntimeException("SQL片段不存在: id=" + taskInfoDto.getSqlSnippetId());
                    }
                    taskInfoBo.setSqlSnippet(sqlSnippetEntity);
                    sqlList = JSONArray.parseArray(sqlSnippetEntity.getSqlList(), String.class);
                } else {
                    // 兼容旧方式：通过dataset(storagePath)查DatasetEntity拿SQL
                    DatasetEntity datasetEntity = datasetService.queryMeta(taskInfoDto.getDataset());
                    taskInfoBo.setDataset(datasetEntity);
                    sqlList = JSONArray.parseArray(datasetEntity.getDatasetSql(), String.class);
                }
                taskInfo.setSqlList(sqlList);
            } else {
                taskInfoBo.setPyTaskName(taskInfoDto.getPyTaskName());
                taskInfo.setPyTaskName(taskInfoDto.getPyTaskName());
            }

            if (taskInfoDto.getTimeout() != null) {
                taskInfoBo.setTimeout(taskInfoDto.getTimeout());
                taskInfo.setTimeout(taskInfoDto.getTimeout());
            }

            taskInfoBoList.add(taskInfoBo);
            taskInfoList.add(taskInfo);

        }

        // 根据exportType确定导出方式
        ExportType exportType = ExportType.findByValue(
                transformCompare.getExportType() != null ? transformCompare.getExportType() : 0);

        String filePath = null;
        if (exportType == ExportType.FILE && transformCompare.getExportFile() != null) {
            String exportFile = transformCompare.getExportFile();
            Path basePath = Paths.get(SchemaPrefix.SYS_DIR_PREFIX, JOB_OUTPUT).toAbsolutePath();
            // 如果路径已以basePath开头，直接使用；否则拼接
            if (exportFile.startsWith(basePath.toString())) {
                filePath = exportFile;
            } else {
                filePath = basePath.resolve(exportFile).toAbsolutePath().toString();
            }
        }

        // 提交任务
        long jobIdLong = StringUtils.hasText(transformCompare.getSchedule()) ?
                iginxSession.commitTransformJob(taskInfoList, ExportType.findByValue(exportType.getValue()), filePath, transformCompare.getSchedule()) :
                iginxSession.commitTransformJob(taskInfoList, ExportType.findByValue(exportType.getValue()), filePath);
        String jobId = String.valueOf(jobIdLong);


        long timestamp = System.currentTimeMillis();

        // 获取操作人
        String operator = OperationLogAspect.getCurrentUser();

        // 获取IP地址
        String clientIp = OperationLogAspect.getClientIp();

        TransformJobEntity transformJobEntity = new TransformJobEntity();
        transformJobEntity.setId(timestamp);
        transformJobEntity.setName(transformCompare.getName());
        transformJobEntity.setTaskList(JSONObject.toJSONString(taskInfoBoList));
        transformJobEntity.setExportFiletName(transformCompare.getExportFile());
        transformJobEntity.setExportType(transformCompare.getExportType());
        transformJobEntity.setSchedule(transformCompare.getSchedule());
        transformJobEntity.setCreateTime(timestamp);
        transformJobEntity.setOperator(operator);
        transformJobEntity.setClientIp(clientIp);
        transformJobEntity.setOwner(transformCompare.getOwner());
        transformJobEntity.setRegisterDatasetVersion(transformCompare.isRegisterDatasetVersion());
        transformJobEntity.setTargetDatasetName(transformCompare.getTargetDatasetName());
        transformJobEntity.setUpstreamVersionIds(transformCompare.getUpstreamVersionIds());
        transformJobEntity.setTransformOutputPath(transformCompare.getTransformOutputPath());
        transformJobEntity.setJobState(0);
        transformJobEntity.setJobId(jobId);

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(transformJobEntity);

        log.info("Transform作业已提交。名称: {}, 时间戳: {}", transformJobEntity.getName(), timestamp);


        return transformJobEntity;
    }

    public synchronized TransformJobEntity statusJob(String jobId) {
        TransformJobEntity transformJob = queryJob(jobId);
        if (transformJob == null) {
            throw new RuntimeException("任务不存在");
        }
        TransformClient transformClient = iginxClient.getTransformClient();
        // 查看任务情况
        JobState jobState = transformClient.queryTransformJobStatus(Long.parseLong(jobId));
        log.info("job state is " + jobState.toString());
        transformJob.setJobState(jobState.getValue());
        transformJob.setId(transformJob.getCreateTime());

        if (jobState == JobState.JOB_FINISHED
                && transformJob.isRegisterDatasetVersion()
                && transformJob.getDatasetVersionId() == null) {
            DatasetVersionRegisterRequest request = new DatasetVersionRegisterRequest();
            request.setDatasetName(transformJob.getTargetDatasetName());
            request.setProvenanceType("TRANSFORM_SQL");
            request.setStoragePath(resolveDatasetOutputPath(transformJob));
            request.setUpstreamVersionIds(JSONArray.parseArray(transformJob.getUpstreamVersionIds(), Long.class));
            Map<String, Object> config = new LinkedHashMap<>();
            config.put("transformJobId", transformJob.getJobId());
            config.put("transformJobName", transformJob.getName());
            config.put("exportType", transformJob.getExportType());
            config.put("exportFile", transformJob.getExportFiletName());
            request.setDerivationConfig(config);
            DatasetVersionEntity version = datasetVersionService.registerVersion(request);
            transformJob.setDatasetVersionId(version.getId());
        }

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(transformJob);
        return transformJob;
        }


    public TransformJobEntity cancelJob(String jobId) {
        TransformJobEntity transformJob = queryJob(jobId);
        if (transformJob == null) {
            throw new RuntimeException("任务不存在");
        }
        try {
            TransformClient transformClient = iginxClient.getTransformClient();
            transformClient.cancelTransformJob(Long.parseLong(jobId));
            // 查看任务情况
            JobState jobState = transformClient.queryTransformJobStatus(Long.parseLong(jobId));
            log.info("job state is " + jobState.toString());
            transformJob.setJobState(jobState.getValue());
        } catch (Exception e) {
            log.error("取消作业异常：{}", e.getMessage());
            transformJob.setJobState(JobState.JOB_UNKNOWN.getValue());
        }
        return saveTransform(transformJob);
    }

    private String resolveDatasetOutputPath(TransformJobEntity job) {
        if (StringUtils.hasText(job.getTransformOutputPath())) {
            return job.getTransformOutputPath();
        }
        if (job.getExportType() == 1 && StringUtils.hasText(job.getExportFiletName())) {
            String file = job.getExportFiletName().replace('\\', '/');
            file = file.substring(file.lastIndexOf('/') + 1);
            return "file_system.sys_data.job." + file;
        }
        throw new IllegalStateException("Transform任务缺少可登记的数据输出路径");
    }

    public List<TransformJobEntity> queryAllJobs(String datasetPath, Integer jobState, Boolean sideLineage) {
        try {
            // 构建基础SQL
            StringBuilder sql = new StringBuilder("SELECT * FROM relational_system.transform_job WHERE 1=1");

            // 添加owner过滤
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                if (! "unknown".equals(currentUser)) {
                    sql.append(" AND owner = '").append(currentUser).append("'");
                }
            }

            // 添加筛选条件
            if (datasetPath != null && !datasetPath.trim().isEmpty()) {
                sql.append(" AND taskList LIKE '^.*").append(datasetPath.trim()).append(".*'");
            }

            if (jobState != null) {
                sql.append(" AND jobState = ").append(jobState);
            }
            sql.append(" ORDER BY createTime DESC");
            sql.append(";");

            log.info("执行SQL: {}", sql);

            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            // 转换为TransformJobEntity列表
            List<TransformJobEntity> result = records.stream().map(record -> {
                TransformJobEntity entity = new TransformJobEntity();
                record.forEach((k, v) -> {
                    String fieldName = k.replace(DATA_PREFIX + ".", "");
                    ConvertUtil.setEntityField(entity, DATA_PREFIX, fieldName, v);
                });
                return entity;
            }).collect(Collectors.toList());

            // 如果旁系血缘关闭，按作业名称分组，每组只保留创建时间最新的那条
            if (sideLineage != null && !sideLineage) {
                Map<String, TransformJobEntity> jobMap = new LinkedHashMap<>();
                for (TransformJobEntity job : result) {
                    String jobName = job.getName() != null ? job.getName() : "";
                    if (!jobMap.containsKey(jobName)) {
                        jobMap.put(jobName, job);
                    }
                }
                result = new ArrayList<>(jobMap.values());
            }

            log.info("查询结果: records={}, sideLineage={}", result.size(), sideLineage);
            return result;
        } catch (Exception e) {
            log.error("查询失败", e);
            return new ArrayList<>();
        }
    }

}
