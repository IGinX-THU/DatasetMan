package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.DataQualityDimension;
import com.tsinghua.dto.QualityAssessmentQueryRequest;
import com.tsinghua.dto.QualityAssessmentRequest;
import com.tsinghua.entity.QualityAssessmentEntity;
import com.tsinghua.enums.DataQualityDimensionEnum;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class QualityAssessmentService {

    private static final String DATA_PREFIX = "relational_system.quality_assessment";

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    public QualityAssessmentEntity saveAssessment(QualityAssessmentRequest request) throws Exception {
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
        JSONObject jobIds = new JSONObject();
        JSONObject exportFiles = new JSONObject();
        JSONObject names = new JSONObject();
        JSONObject scores = new JSONObject();
        putDimension(weights, jobs, jobIds, exportFiles, names, scores, DataQualityDimensionEnum.qcom, request.getQcom());
        putDimension(weights, jobs, jobIds, exportFiles, names, scores, DataQualityDimensionEnum.qcon, request.getQcon());
        putDimension(weights, jobs, jobIds, exportFiles, names, scores, DataQualityDimensionEnum.qtim, request.getQtim());
        putDimension(weights, jobs, jobIds, exportFiles, names, scores, DataQualityDimensionEnum.qval, request.getQval());

        QualityAssessmentEntity entity = new QualityAssessmentEntity();
        entity.setId(timestamp);
        entity.setCriteriaId(request.getCriteriaId());
        entity.setCriteriaName(request.getCriteriaName());
        entity.setDescription(request.getDescription());
        entity.setWeights(JSONObject.toJSONString(weights));
        entity.setJobs(JSONObject.toJSONString(jobs));
        entity.setJobIds(JSONObject.toJSONString(jobIds));
        entity.setExportFiles(JSONObject.toJSONString(exportFiles));
        entity.setNames(JSONObject.toJSONString(names));
        entity.setScores(JSONObject.toJSONString(scores));
        entity.setDqi(request.getDqi());
        entity.setPassed(request.getPassed());
        entity.setCreateTime(timestamp);
        entity.setOperator(operator);
        entity.setClientIp(clientIp);
        entity.setOwner(StringUtils.hasText(request.getOwner()) ? request.getOwner() : AuthUtil.getCurrentUsername());

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(entity);

        log.info("质量测评记录已保存。criteriaName: {}, 时间戳: {}", entity.getCriteriaName(), timestamp);
        return entity;
    }

    public List<QualityAssessmentEntity> queryAssessments(QualityAssessmentQueryRequest request) {
        try {
            StringBuilder sql = new StringBuilder("SELECT * FROM relational_system.quality_assessment WHERE 1=1");

            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql.append(" AND owner = '").append(currentUser).append("'");
            }

            if (request.getCriteriaName() != null && !request.getCriteriaName().trim().isEmpty()) {
                sql.append(" AND criteriaName LIKE '^.*").append(request.getCriteriaName().trim()).append(".*'");
            }

            sql.append(" ORDER BY createTime DESC");
            sql.append(" LIMIT ").append(request.getPageSize());
            sql.append(" OFFSET ").append((request.getPageNum() - 1) * request.getPageSize());
            sql.append(";");

            log.info("执行SQL: {}", sql);
            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            return records.stream().map(record -> {
                QualityAssessmentEntity entity = new QualityAssessmentEntity();
                record.forEach((k, v) -> {
                    String fieldName = k.replace(DATA_PREFIX + ".", "");
                    ConvertUtil.setEntityField(entity, DATA_PREFIX, fieldName, v);
                });
                return entity;
            }).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("查询质量测评记录失败", e);
            return new ArrayList<>();
        }
    }

    public Object countAssessments(QualityAssessmentQueryRequest request) {
        try {
            StringBuilder sql = new StringBuilder("SELECT COUNT(1) FROM relational_system.quality_assessment WHERE 1=1");
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                sql.append(" AND owner = '").append(currentUser).append("'");
            }
            if (request.getCriteriaName() != null && !request.getCriteriaName().trim().isEmpty()) {
                sql.append(" AND criteriaName LIKE '%").append(request.getCriteriaName().trim()).append("%'");
            }
            sql.append(";");

            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            return res.getValues().get(0).get(0);
        } catch (Exception e) {
            log.error("统计质量测评记录失败", e);
            return 0;
        }
    }

    public QualityAssessmentEntity queryById(Long id) {
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

            QualityAssessmentEntity entity = new QualityAssessmentEntity();
            Map<String, Object> rs = records.get(0);
            rs.forEach((k, v) -> {
                String fieldName = k.replace(DATA_PREFIX + ".", "");
                ConvertUtil.setEntityField(entity, DATA_PREFIX, fieldName, v);
            });
            return entity;
        } catch (Exception e) {
            log.error("查询质量测评记录详情失败", e);
            return null;
        }
    }

    public void deleteAssessment(Long id) {
        try {
            QualityAssessmentEntity entity = new QualityAssessmentEntity();
            entity.setId(id);
            List<String> measurements = ConvertUtil.iginxFieldNamesConvert(QualityAssessmentEntity.class, DATA_PREFIX);
            iginxClient.getDeleteClient().deleteMeasurementsData(measurements, id - 1, id + 1);
            log.info("已删除质量测评记录: id: {}", id);
        } catch (Exception e) {
            log.error("删除质量测评记录失败", e);
            throw new RuntimeException("删除质量测评记录失败: " + e.getMessage(), e);
        }
    }

    private void validateDimensionData(QualityAssessmentRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("质量测评请求不能为空");
        }
        if (request.getCriteriaId() == null) {
            throw new IllegalArgumentException("质量测评记录必须关联评价准则ID");
        }
        validateDimension(DataQualityDimensionEnum.qcom, request.getQcom());
        validateDimension(DataQualityDimensionEnum.qcon, request.getQcon());
        validateDimension(DataQualityDimensionEnum.qtim, request.getQtim());
        validateDimension(DataQualityDimensionEnum.qval, request.getQval());
    }

    private void validateDimension(DataQualityDimensionEnum dim, DataQualityDimension dimension) {
        if (dimension == null) {
            throw new IllegalArgumentException(dim.getLabel() + "维度信息缺失");
        }
        if (dimension.getWeight() == null) {
            throw new IllegalArgumentException(dim.getLabel() + "维度缺少权重");
        }
        if (!StringUtils.hasText(dimension.getTransformId())) {
            throw new IllegalArgumentException(dim.getLabel() + "维度缺少编排绑定");
        }
        if (!StringUtils.hasText(dimension.getJobId())) {
            throw new IllegalArgumentException(dim.getLabel() + "维度缺少任务jobId");
        }
    }

    private void putDimension(JSONObject weights, JSONObject jobs, JSONObject jobIds,
                              JSONObject exportFiles, JSONObject names, JSONObject scores,
                              DataQualityDimensionEnum dim, DataQualityDimension dimension) {
        if (dimension != null) {
            String code = dim.name();
            weights.put(code, dimension.getWeight());
            jobs.put(code, dimension.getTransformId());
            jobIds.put(code, dimension.getJobId());
            exportFiles.put(code, dimension.getExportFile());
            names.put(code, dimension.getName());
            scores.put(code, dimension.getScore());
        }
    }

}
