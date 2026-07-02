package com.tsinghua.service;

import cn.edu.tsinghua.iginx.exception.SessionException;
import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.TransformJobQueryRequest;
import com.tsinghua.dto.TransformJobRequest;
import com.tsinghua.entity.TransformCompareEntity;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TransformCompareService {

    private static final String DATA_PREFIX = "relational_system.transform_compare";

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    public TransformCompareEntity saveTransform(TransformJobRequest request) throws Exception {

        // 检查作业名称是否重复（仅在新增时检查）
        if (request.getCreateTime() == null) {
            String checkSql = String.format("SELECT COUNT(1) FROM %s WHERE name = '%s';", DATA_PREFIX, request.getName());
            log.info("检查作业名称重复SQL: {}", checkSql);
            
            try {
                SessionExecuteSqlResult checkRes = iginxSession.executeSql(checkSql);
                Object count = checkRes.getValues().get(0).get(0);
                if (count != null && !count.equals(0L)) {
                    throw new RuntimeException("作业名称已存在，请使用其他名称");
                }
            } catch (Exception e) {
                if (e.getMessage().contains("作业名称已存在")) {
                    throw new IllegalArgumentException(e.getMessage());
                }
                log.error("检查作业名称失败", e);
                throw e;
            }
        }

        long timestamp = Objects.nonNull(request.getCreateTime()) ? request.getCreateTime() : System.currentTimeMillis();

        // 获取操作人
        String operator = OperationLogAspect.getCurrentUser();

        // 获取IP地址
        String clientIp = OperationLogAspect.getClientIp();

        TransformCompareEntity transformCompareEntity = new TransformCompareEntity();
        transformCompareEntity.setId(timestamp);
        transformCompareEntity.setName(request.getName());
        transformCompareEntity.setTaskList(JSONObject.toJSONString(request.getTaskList()));
        transformCompareEntity.setExportType(request.getExportType());
        transformCompareEntity.setExportFile(request.getExportFile());
        transformCompareEntity.setSchedule(request.getSchedule());
        transformCompareEntity.setCreateTime(timestamp);
        transformCompareEntity.setOperator(operator);
        transformCompareEntity.setClientIp(clientIp);
        transformCompareEntity.setOwner(AuthUtil.getCurrentUsername());

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(transformCompareEntity);

        log.info("Transform作业已保存。名称: {}, 时间戳: {}", transformCompareEntity.getName(), timestamp);

        return transformCompareEntity;
    }

    public List<TransformCompareEntity> queryJobs(TransformJobQueryRequest request) {
        try {
            // 构建基础SQL
            StringBuilder sql = new StringBuilder("SELECT * FROM relational_system.transform_compare WHERE 1=1");

            // 添加owner过滤
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql.append(" AND owner = '").append(currentUser).append("'");
            }

            // 添加筛选条件
            if (request.getName() != null && !request.getName().trim().isEmpty()) {
                sql.append(" AND name LIKE '^.*").append(request.getName().trim()).append(".*'");
            }

            // 添加排序和分页
            sql.append(" ORDER BY createTime DESC");
            sql.append(" LIMIT ").append(request.getPageSize());
            sql.append(" OFFSET ").append((request.getPageNum() - 1) * request.getPageSize());
            sql.append(";");

            log.info("执行SQL: {}", sql);

            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            // 转换为TransformCompareEntity列表
            List<TransformCompareEntity> result = records.stream().map(record -> {
                TransformCompareEntity entity = new TransformCompareEntity();
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
            StringBuilder sql = new StringBuilder("SELECT COUNT(1) FROM relational_system.transform_compare WHERE 1=1");

            // 添加owner过滤
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql.append(" AND owner = '").append(currentUser).append("'");
            }

            // 添加筛选条件
            if (request.getName() != null && !request.getName().trim().isEmpty()) {
                sql.append(" AND name LIKE '%").append(request.getName().trim()).append("%'");
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

    public TransformCompareEntity queryJob(Long createTime) {
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

            TransformCompareEntity entity = new TransformCompareEntity();
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
            TransformCompareEntity entity = queryJob(createTime);
            if (entity == null) {
                throw new RuntimeException("作业不存在或无权删除");
            }
            
            List<String> measurements = ConvertUtil.iginxFieldNamesConvert(TransformCompareEntity.class, DATA_PREFIX);
            iginxClient.getDeleteClient().deleteMeasurementsData(measurements, createTime - 1, createTime + 1);
            log.info("已删除Transform作业: createTime: {}", createTime);
        } catch (Exception e) {
            log.error("删除Transform作业失败", e);
            throw new RuntimeException("删除Transform作业失败: " + e.getMessage(), e);
        }
    }
}
