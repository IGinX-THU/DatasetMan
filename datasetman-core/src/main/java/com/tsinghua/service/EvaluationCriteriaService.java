package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.DataQualityDimension;
import com.tsinghua.dto.EvaluationCriteriaQueryRequest;
import com.tsinghua.dto.EvaluationCriteriaRequest;
import com.tsinghua.entity.EvaluationCriteriaEntity;
import com.tsinghua.enums.DataQualityDimensionEnum;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class EvaluationCriteriaService {

    private static final String DATA_PREFIX = "relational_system.evaluation_criteria";

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    public EvaluationCriteriaEntity saveCriteria(EvaluationCriteriaRequest request) throws Exception {
        if (request.getId() == null) {
            String checkSql = String.format("SELECT COUNT(1) FROM %s WHERE name = '%s';", DATA_PREFIX, request.getName());
            log.info("检查准则名称重复SQL: {}", checkSql);
            try {
                SessionExecuteSqlResult checkRes = iginxSession.executeSql(checkSql);
                if (!CollectionUtils.isEmpty(checkRes.getValues()) && !CollectionUtils.isEmpty(checkRes.getValues().get(0))) {
                    Object count = checkRes.getValues().get(0).get(0);
                    if (count != null && !count.equals(0L)) {
                        throw new RuntimeException("准则名称已存在，请使用其他名称");
                    }
                }
            } catch (Exception e) {
                if (e.getMessage().contains("准则名称已存在")) {
                    throw new IllegalArgumentException(e.getMessage());
                }
                log.error("检查准则名称失败", e);
                throw e;
            }
        }

        long timestamp;
        if (request.getId() != null) {
            timestamp = request.getId();
        } else {
            timestamp = System.currentTimeMillis();
        }
        validateDimensionData(request);

        String operator = OperationLogAspect.getCurrentUser();
        String clientIp = OperationLogAspect.getClientIp();

        JSONObject weights = new JSONObject();
        JSONObject jobs = new JSONObject();
        JSONObject exportFiles = new JSONObject();
        JSONObject names = new JSONObject();
        putDimension(weights, jobs, exportFiles, names, DataQualityDimensionEnum.qcom, request.getQcom());
        putDimension(weights, jobs, exportFiles, names, DataQualityDimensionEnum.qcon, request.getQcon());
        putDimension(weights, jobs, exportFiles, names, DataQualityDimensionEnum.qtim, request.getQtim());
        putDimension(weights, jobs, exportFiles, names, DataQualityDimensionEnum.qval, request.getQval());

        EvaluationCriteriaEntity entity = new EvaluationCriteriaEntity();
        entity.setId(timestamp);
        entity.setName(request.getName());
        entity.setDescription(request.getDescription());
        entity.setWeights(JSONObject.toJSONString(weights));
        entity.setJobs(JSONObject.toJSONString(jobs));
        entity.setExportFiles(JSONObject.toJSONString(exportFiles));
        entity.setNames(JSONObject.toJSONString(names));
        entity.setCreateTime(timestamp);
        entity.setOperator(operator);
        entity.setClientIp(clientIp);
        entity.setOwner(StringUtils.hasText(request.getOwner()) ? request.getOwner() : AuthUtil.getCurrentUsername());

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(entity);

        log.info("评价准则已保存。名称: {}, 时间戳: {}", entity.getName(), timestamp);
        return entity;
    }

    public List<EvaluationCriteriaEntity> queryCriteria(EvaluationCriteriaQueryRequest request) {
        try {
            StringBuilder sql = new StringBuilder("SELECT * FROM relational_system.evaluation_criteria WHERE 1=1");

            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql.append(" AND owner = '").append(currentUser).append("'");
            }

            if (request.getName() != null && !request.getName().trim().isEmpty()) {
                sql.append(" AND name LIKE '^.*").append(request.getName().trim()).append(".*'");
            }

            sql.append(" ORDER BY createTime DESC");
            sql.append(" LIMIT ").append(request.getPageSize());
            sql.append(" OFFSET ").append((request.getPageNum() - 1) * request.getPageSize());
            sql.append(";");

            log.info("执行SQL: {}", sql);
            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            return records.stream().map(record -> {
                EvaluationCriteriaEntity entity = new EvaluationCriteriaEntity();
                record.forEach((k, v) -> {
                    String fieldName = k.replace(DATA_PREFIX + ".", "");
                    ConvertUtil.setEntityField(entity, DATA_PREFIX, fieldName, v);
                });
                return entity;
            }).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("查询评价准则失败", e);
            return new ArrayList<>();
        }
    }

    public Object countCriteria(EvaluationCriteriaQueryRequest request) {
        try {
            StringBuilder sql = new StringBuilder("SELECT COUNT(1) FROM relational_system.evaluation_criteria WHERE 1=1");
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql.append(" AND owner = '").append(currentUser).append("'");
            }
            if (request.getName() != null && !request.getName().trim().isEmpty()) {
                sql.append(" AND name LIKE '%").append(request.getName().trim()).append("%'");
            }
            sql.append(";");

            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            return res.getValues().get(0).get(0);
        } catch (Exception e) {
            log.error("统计评价准则失败", e);
            return 0;
        }
    }

    public EvaluationCriteriaEntity queryById(Long id) {
        try {
            String sql = "select * from %s where createTime = " + id;
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql += " AND owner = '" + currentUser + "'";
            }
            sql += ";";
            SessionExecuteSqlResult res = iginxSession.executeSql(String.format(sql, DATA_PREFIX));
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            if (records.isEmpty()) {
                return null;
            }

            EvaluationCriteriaEntity entity = new EvaluationCriteriaEntity();
            Map<String, Object> rs = records.get(0);
            rs.forEach((k, v) -> {
                String fieldName = k.replace(DATA_PREFIX + ".", "");
                ConvertUtil.setEntityField(entity, DATA_PREFIX, fieldName, v);
            });
            return entity;
        } catch (Exception e) {
            log.error("查询评价准则详情失败", e);
            return null;
        }
    }

    public void deleteCriteria(Long id) {
        try {
            EvaluationCriteriaEntity entity = new EvaluationCriteriaEntity();
            entity.setId(id);
            List<String> measurements = ConvertUtil.iginxFieldNamesConvert(EvaluationCriteriaEntity.class, DATA_PREFIX);
            iginxClient.getDeleteClient().deleteMeasurementsData(measurements, id - 1, id + 1);
            log.info("已删除评价准则: id: {}", id);
        } catch (Exception e) {
            log.error("删除评价准则失败", e);
            throw new RuntimeException("删除评价准则失败: " + e.getMessage(), e);
        }
    }

    private void validateDimensionData(EvaluationCriteriaRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("评价准则请求不能为空");
        }
        validateDimension(DataQualityDimensionEnum.qcom, request.getQcom());
        validateDimension(DataQualityDimensionEnum.qcon, request.getQcon());
        validateDimension(DataQualityDimensionEnum.qtim, request.getQtim());
        validateDimension(DataQualityDimensionEnum.qval, request.getQval());
        double sum = 0.0;
        if (request.getQcom() != null) sum += request.getQcom().getWeight();
        if (request.getQcon() != null) sum += request.getQcon().getWeight();
        if (request.getQtim() != null) sum += request.getQtim().getWeight();
        if (request.getQval() != null) sum += request.getQval().getWeight();
        if (Math.abs(sum - 1.0) > 0.001) {
            throw new IllegalArgumentException("四维度的权重合计必须等于1");
        }
    }

    private void validateDimension(DataQualityDimensionEnum dim, DataQualityDimension dimension) {
        if (dimension == null) {
            throw new IllegalArgumentException(dim.getLabel() + "维度信息缺失");
        }
        if (dimension.getWeight() == null) {
            throw new IllegalArgumentException(dim.getLabel() + "维度缺少权重");
        }
        if (dimension.getWeight() < 0 || dimension.getWeight() > 1) {
            throw new IllegalArgumentException(dim.getLabel() + "维度权重需在0-1之间");
        }
        if (!StringUtils.hasText(dimension.getTransformId())) {
            throw new IllegalArgumentException(dim.getLabel() + "维度缺少编排绑定");
        }
        if (dimension.getExportFile() == null) {
            throw new IllegalArgumentException(dim.getLabel() + "维度缺少导出文件名");
        }
        if (dimension.getName() == null) {
            throw new IllegalArgumentException(dim.getLabel() + "维度缺少编排名称");
        }
    }

    private void putDimension(JSONObject weights, JSONObject jobs, JSONObject exportFiles, JSONObject names,
                              DataQualityDimensionEnum dim, DataQualityDimension dimension) {
        if (dimension != null) {
            String code = dim.name();
            weights.put(code, dimension.getWeight());
            jobs.put(code, dimension.getTransformId());
            exportFiles.put(code, dimension.getExportFile());
            names.put(code, dimension.getName());
        }
    }

}
