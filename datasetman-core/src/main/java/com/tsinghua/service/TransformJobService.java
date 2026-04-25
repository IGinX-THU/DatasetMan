package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.write.Point;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.dto.TransformJobQueryRequest;
import com.tsinghua.dto.TransformJobRequest;
import com.tsinghua.entity.TransformJobEntity;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TransformJobService {

    private static final String DATA_PREFIX = "relational_system.transform_job";

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    public TransformJobEntity saveTransform(TransformJobRequest runTaskRequest) {
        List<Point> metaPoints = new ArrayList<>();
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

        // 创建各个字段的数据点
        metaPoints.add(ConvertUtil.createFieldPoint(DATA_PREFIX, "name", transformJobEntity.getName(), timestamp));
        metaPoints.add(ConvertUtil.createFieldPoint(DATA_PREFIX, "taskList", transformJobEntity.getTaskList(), timestamp));
        metaPoints.add(ConvertUtil.createFieldPoint(DATA_PREFIX, "exportFiletName", transformJobEntity.getExportFiletName(), timestamp));
        metaPoints.add(ConvertUtil.createFieldPoint(DATA_PREFIX, "schedule", transformJobEntity.getSchedule(), timestamp));
        metaPoints.add(ConvertUtil.createFieldPoint(DATA_PREFIX, "createTime", transformJobEntity.getCreateTime(), timestamp));
        metaPoints.add(ConvertUtil.createFieldPoint(DATA_PREFIX, "operator", transformJobEntity.getOperator(), timestamp));
        metaPoints.add(ConvertUtil.createFieldPoint(DATA_PREFIX, "clientIp", transformJobEntity.getClientIp(), timestamp));

        // 批量写入元数据
        iginxClient.getWriteClient().writePoints(metaPoints.stream().filter(Objects::nonNull).collect(Collectors.toList()));
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

    public TransformJobEntity queryJob(Long id) {
        try {
            String sql = "select * from %s where id = %s;";
            SessionExecuteSqlResult res = iginxSession.executeSql(String.format(sql, DATA_PREFIX, id));
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

    public void deleteJob(Long id) {
        try {
            List<String> measurements = ConvertUtil.iginxFieldNamesConvert(TransformJobEntity.class, DATA_PREFIX);
            iginxClient.getDeleteClient().deleteMeasurementsData(measurements, id - 1, id + 1);
            log.info("已删除Transform作业: id: {}", id);
        } catch (Exception e) {
            log.error("删除Transform作业失败", e);
            throw new RuntimeException("删除Transform作业失败: " + e.getMessage(), e);
        }
    }
}
