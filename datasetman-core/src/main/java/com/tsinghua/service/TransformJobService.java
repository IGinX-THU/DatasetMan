package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.TransformClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import cn.edu.tsinghua.iginx.session_v2.domain.Task;
import cn.edu.tsinghua.iginx.session_v2.domain.Transform;
import cn.edu.tsinghua.iginx.session_v2.write.Point;
import cn.edu.tsinghua.iginx.thrift.DataFlowType;
import cn.edu.tsinghua.iginx.thrift.ExportType;
import cn.edu.tsinghua.iginx.thrift.TaskInfo;
import cn.edu.tsinghua.iginx.thrift.TaskType;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.alibaba.fastjson2.TypeReference;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.dto.TaskInfoBo;
import com.tsinghua.dto.TaskInfoDto;
import com.tsinghua.dto.TransformJobQueryRequest;
import com.tsinghua.dto.TransformJobRequest;
import com.tsinghua.dto.request.FilesystemStorageRequest;
import com.tsinghua.entity.DatasetEntity;
import com.tsinghua.entity.ParsingRulesEntity;
import com.tsinghua.entity.TransformCompareEntity;
import com.tsinghua.entity.TransformJobEntity;
import com.tsinghua.model.Result;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TransformJobService {

    private static final String DATA_PREFIX = "relational_system.transform_job";
    private static final String FUNCTION_DIR_PREFIX = "function";

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

    @Value("${iginx.ip}")
    private String ip;

    @Value("${iginx.port}")
    private int port;

    @PostConstruct
    private void init() {
        try {
            // 创建函数目录
            Path pathDir = Paths.get(FUNCTION_DIR_PREFIX, "job");
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
            request.setSchemaPrefix("file_system");
            request.setPort(6666);
            request.setDummyDir(Paths.get(FUNCTION_DIR_PREFIX).toAbsolutePath().toString());
            dataSourceService.registerDataSource(request);
        } catch (Exception e) {
            log.error(e.getMessage());
        }

    }

    public TransformJobEntity saveTransform(TransformJobRequest runTaskRequest) {

        long timestamp = System.currentTimeMillis();

        // 获取操作人
        String operator = OperationLogAspect.getCurrentUser();

        // 获取IP地址
        String clientIp = OperationLogAspect.getClientIp();

        TransformJobEntity transformJobEntity = new TransformJobEntity();
        transformJobEntity.setId(timestamp);
        transformJobEntity.setName(runTaskRequest.getName());
        transformJobEntity.setTaskList(JSONObject.toJSONString(runTaskRequest.getTaskList()));
        transformJobEntity.setExportFiletName(runTaskRequest.getExportFiletName());
        transformJobEntity.setSchedule(runTaskRequest.getSchedule());
        transformJobEntity.setCreateTime(timestamp);
        transformJobEntity.setOperator(operator);
        transformJobEntity.setClientIp(clientIp);
        transformJobEntity.setJobState(0);

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(transformJobEntity);

        log.info("Transform作业已保存。名称: {}, 时间戳: {}", transformJobEntity.getName(), timestamp);

        return transformJobEntity;
    }

    public List<TransformJobEntity> queryJobs(TransformJobQueryRequest request) {
        try {
            // 构建基础SQL
            StringBuilder sql = new StringBuilder("SELECT * FROM relational_system.transform_job WHERE 1=1");
            
            // 添加筛选条件
            if (request.getName() != null && !request.getName().trim().isEmpty()) {
                sql.append(" AND name LIKE '^.*").append(request.getName().trim()).append(".*'");
            }
            
            if (request.getJobState() != null) {
                sql.append(" AND JobState = ").append(request.getJobState());
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
            
            // 添加筛选条件
            if (request.getName() != null && !request.getName().trim().isEmpty()) {
                sql.append(" AND name LIKE '%").append(request.getName().trim()).append("%'");
            }
            
            if (request.getJobState() != null) {
                sql.append(" AND JobState = ").append(request.getJobState());
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

    public TransformJobEntity queryJob(Long createTime) {
        try {
            String sql = "select * from %s where createTime = %s;";
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

    public void deleteJob(Long createTime) {
        try {
            List<String> measurements = ConvertUtil.iginxFieldNamesConvert(TransformJobEntity.class, DATA_PREFIX);
            iginxClient.getDeleteClient().deleteMeasurementsData(measurements, createTime - 1, createTime + 1);
            log.info("已删除Transform作业: createTime: {}", createTime);
        } catch (Exception e) {
            log.error("删除Transform作业失败", e);
            throw new RuntimeException("删除Transform作业失败: " + e.getMessage(), e);
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
                DatasetEntity datasetEntity = datasetService.queryMeta(taskInfoDto.getDataset());
                taskInfoBo.setDataset(datasetEntity);

                List<String> sqlList = JSONArray.parseArray(datasetEntity.getDatasetSql(), String.class);
                taskInfo.setSqlList(sqlList);
            } else {
                taskInfoBo.setPyTaskName(taskInfoDto.getPyTaskName());
                taskInfo.setPyTaskName(taskInfoDto.getPyTaskName());
            }

            taskInfoBo.setTimeout(taskInfoDto.getTimeout());
            taskInfo.setTimeout(taskInfoDto.getTimeout());

            taskInfoBoList.add(taskInfoBo);
            taskInfoList.add(taskInfo);

        }

        Path filePath = Paths.get(FUNCTION_DIR_PREFIX, "job").resolve(transformCompare.getExportFiletName()).toAbsolutePath();

        // 提交任务
        long jobId =
                iginxSession.commitTransformJob(
                        taskInfoList,
                        ExportType.FILE,
                        filePath.toString());


        long timestamp = System.currentTimeMillis();

        // 获取操作人
        String operator = OperationLogAspect.getCurrentUser();

        // 获取IP地址
        String clientIp = OperationLogAspect.getClientIp();

        TransformJobEntity transformJobEntity = new TransformJobEntity();
        transformJobEntity.setId(timestamp);
        transformJobEntity.setName(transformCompare.getName());
        transformJobEntity.setTaskList(JSONObject.toJSONString(taskInfoBoList));
        transformJobEntity.setExportFiletName(transformCompare.getExportFiletName());
        transformJobEntity.setSchedule(transformCompare.getSchedule());
        transformJobEntity.setCreateTime(timestamp);
        transformJobEntity.setOperator(operator);
        transformJobEntity.setClientIp(clientIp);
        transformJobEntity.setJobState(0);
        transformJobEntity.setJobId(jobId);

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(transformJobEntity);

        log.info("Transform作业已提交。名称: {}, 时间戳: {}", transformJobEntity.getName(), timestamp);


        return transformJobEntity;
    }

}
