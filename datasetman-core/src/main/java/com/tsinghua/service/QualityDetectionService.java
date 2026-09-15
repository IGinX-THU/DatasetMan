package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.entity.QualityAssessmentEntity;
import com.tsinghua.enums.DataQualityDimensionEnum;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * 数据集质量自动检测（对应课题测试方案 4.3.1.6 数据质量综合指标测试方案）：
 * 对指定数据集版本的实际数据抽样，自动执行 4 个维度的检测规则——
 *   完整性 qcom：必填字段齐备（非空单元格占比）
 *   一致性 qcon：行唯一性（重复行率），跨源口径一致性的基础校验
 *   时效性 qtim：数据最新记录年龄（每滞后1天扣2分，钳制[0,100]）
 *   有效性 qval：字段格式、取值范围、枚举编码、数据类型符合规则
 *                （语义规则与格式规则同时通过的单元格占比）
 * DQI 为加权综合得分（权重和为1，默认各0.25），达标线95分。
 * 输出各维度得分、评价依据、不满足规则的数据项摘要。全程无人工录入。
 */
@Slf4j
@Service
public class QualityDetectionService {

    private static final int SAMPLE_SIZE = 200;
    private static final double DEFAULT_WEIGHT = 0.25;

    /** 时间类字段名（用于时效性检测） */
    private static final String[] TIME_COLUMNS = {"create_time", "createtime", "time", "timestamp", "date"};

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    @Autowired
    private DatasetVersionService datasetVersionService;

    @Autowired
    private QualityReportService qualityReportService;

    @Autowired
    private com.tsinghua.service.EvaluationCriteriaService evaluationCriteriaService;

    /**
     * 自动检测。
     * @param versionId 数据集版本
     * @param sampleSize 请求抽样行数（实际抽样 = min(请求, 数据集可查询行数)）
     * @param criteriaId 可选，评价准则ID：提供时使用准则配置的权重，缺省各维度0.25
     */
    public QualityAssessmentEntity autoDetect(Long versionId, Integer sampleSize, Long criteriaId) {
        int size = (sampleSize == null || sampleSize < 1) ? SAMPLE_SIZE : Math.min(sampleSize, 50000);
        DatasetVersionEntity version = datasetVersionService.queryVersion(versionId);
        if (version == null) {
            throw new RuntimeException("版本不存在: " + versionId);
        }
        com.tsinghua.entity.EvaluationCriteriaEntity criteria = null;
        if (criteriaId != null) {
            criteria = evaluationCriteriaService.queryById(criteriaId);
        }
        List<Map<String, Object>> sample = sampleData(version.getStoragePath(), size);
        DetectionResult result = detect(sample, version, size);

        long timestamp = System.currentTimeMillis();
        QualityAssessmentEntity entity = new QualityAssessmentEntity();
        entity.setId(timestamp);
        // 关联评价准则（权重取自准则），否则记录为独立自动检测
        entity.setCriteriaId(criteria != null ? criteriaId : version.getId());
        entity.setCriteriaName(criteria != null
                ? criteria.getName()
                : "自动检测-" + version.getDatasetName());
        entity.setDescription(String.format("对数据集 %s %s 的4维度自动质量检测（实际抽样 %d 行）",
                version.getDatasetName(), version.getVersionNo(), result.sampleSize));

        JSONObject weights = new JSONObject();
        JSONObject scores = new JSONObject();
        JSONObject jobs = new JSONObject();
        JSONObject jobIds = new JSONObject();
        JSONObject exportFiles = new JSONObject();
        JSONObject names = new JSONObject();
        JSONObject criteriaWeights = parseJson(criteria != null ? criteria.getWeights() : null);
        JSONObject criteriaJobs = parseJson(criteria != null ? criteria.getJobs() : null);
        JSONObject criteriaExportFiles = parseJson(criteria != null ? criteria.getExportFiles() : null);
        JSONObject criteriaNames = parseJson(criteria != null ? criteria.getNames() : null);
        for (DataQualityDimensionEnum dim : DataQualityDimensionEnum.values()) {
            String code = dim.name();
            Double w = toDouble(criteriaWeights.get(code));
            weights.put(code, w != null && w > 0 ? w : DEFAULT_WEIGHT);
            scores.put(code, result.scores.getOrDefault(code, 0.0));
            names.put(code, dim.getLabel());
            Object boundJob = criteriaJobs.get(code);
            jobs.put(code, boundJob != null ? boundJob : "auto-detect");
            jobIds.put(code, String.valueOf(timestamp));
            Object exportFile = criteriaExportFiles.get(code);
            exportFiles.put(code, exportFile != null ? exportFile : "");
        }
        entity.setWeights(weights.toJSONString());
        entity.setScores(scores.toJSONString());
        entity.setJobs(jobs.toJSONString());
        entity.setJobIds(jobIds.toJSONString());
        entity.setExportFiles(exportFiles.toJSONString());
        entity.setNames(names.toJSONString());
        // 综合得分按准则权重加权（默认各0.25）
        double weighted = 0.0, weightSum = 0.0;
        for (DataQualityDimensionEnum dim : DataQualityDimensionEnum.values()) {
            Double w = toDouble(weights.get(dim.name()));
            if (w != null && w > 0) {
                weighted += result.scores.getOrDefault(dim.name(), 0.0) * w;
                weightSum += w;
            }
        }
        double dqi = weightSum > 0 ? round(weighted / weightSum) : result.composite;
        entity.setDqi(String.valueOf(dqi));
        entity.setPassed(dqi >= QualityReportService.PASS_THRESHOLD ? "true" : "false");
        entity.setDetailJson(result.details.toJSONString());
        entity.setCreateTime(timestamp);
        entity.setOperator(OperationLogAspect.getCurrentUser());
        entity.setClientIp(OperationLogAspect.getClientIp());
        entity.setOwner(AuthUtil.getCurrentUsername());
        entity.setDatasetName(version.getDatasetName());
        entity.setVersionNo(version.getVersionNo());
        entity.setReportJson(qualityReportService.generateReport(entity));

        iginxClient.getWriteClient().writeMeasurement(entity);
        log.info("质量自动检测完成。dataset={}, versionId={}, dqi={}, sampleSize={}",
                version.getDatasetName(), versionId, dqi, result.sampleSize);
        return entity;
    }

    // ====================================================================
    // 检测逻辑
    // ====================================================================

    private static class DetectionResult {
        final Map<String, Double> scores = new LinkedHashMap<>();
        final JSONObject details = new JSONObject();
        double composite;
        int sampleSize;
    }

    private DetectionResult detect(List<Map<String, Object>> sample, DatasetVersionEntity version, int requestSize) {
        DetectionResult r = new DetectionResult();
        r.sampleSize = sample.size();

        if (sample.isEmpty()) {
            for (DataQualityDimensionEnum dim : DataQualityDimensionEnum.values()) {
                r.scores.put(dim.name(), 0.0);
            }
            r.composite = 0.0;
            r.details.put("error", "未查询到可检测数据（storagePath=" + version.getStoragePath() + "）");
            r.details.put("sampling", samplingNote(0, requestSize, version));
            return r;
        }

        long totalCells = 0, nonNullCells = 0, validCells = 0;
        // 未通过原因聚合：key = "列名|规则"，value = 次数
        Map<String, Long> qcomFailures = new LinkedHashMap<>();   // 列名 -> 空值次数
        Map<String, Long> qvalFailures = new LinkedHashMap<>();   // "列名|规则" -> 次数
        Set<String> seenRows = new HashSet<>();
        int duplicateRows = 0;
        long newestTime = -1;

        for (Map<String, Object> row : sample) {
            StringBuilder rowKey = new StringBuilder();
            String timeCol = findTimeColumn(row);
            for (Map.Entry<String, Object> cell : row.entrySet()) {
                String col = shortName(cell.getKey());
                Object v = cell.getValue();
                totalCells++;
                if (v == null || String.valueOf(v).trim().isEmpty()) {
                    qcomFailures.merge(col, 1L, Long::sum);
                    rowKey.append(col).append('=').append(v).append('|');
                    continue;
                }
                nonNullCells++;
                String accFail = accurateRuleFailed(col, v);
                String confFail = conformantRuleFailed(col, v);
                if (accFail == null && confFail == null) {
                    validCells++;
                } else {
                    String rule = accFail != null ? accFail : confFail;
                    qvalFailures.merge(col + " " + rule, 1L, Long::sum);
                }
                rowKey.append(col).append('=').append(v).append('|');
            }
            if (!seenRows.add(rowKey.toString())) duplicateRows++;

            if (timeCol != null) {
                Long t = parseTime(shortName(timeCol), row.get(timeCol));
                if (t != null && t > newestTime) newestTime = t;
            }
        }

        // 完整性：非空单元格占比
        double qcom = 100.0 * nonNullCells / totalCells;
        // 一致性：1 - 重复行率
        double qcon = 100.0 * (1.0 - (double) duplicateRows / sample.size());
        // 时效性：最新记录年龄，每滞后1天扣2分（无时间字段则按版本登记时间）
        long reference = newestTime > 0 ? newestTime
                : (version.getCreateTime() != null ? version.getCreateTime() : 0);
        double ageDays = reference > 0 ? (System.currentTimeMillis() - reference) / 86400000.0 : 0;
        // 钳制到[0,100]：数据时间在未来（如补录）时年龄为负，不得超出满分
        double qtim = Math.min(100.0, Math.max(0.0, 100.0 - ageDays * 2.0));
        // 有效性：语义规则与格式规则同时通过的单元格占比
        double qval = 100.0 * validCells / totalCells;

        r.scores.put("qcom", round(qcom));
        r.scores.put("qcon", round(qcon));
        r.scores.put("qtim", round(qtim));
        r.scores.put("qval", round(qval));
        r.composite = round((qcom + qcon + qtim + qval) / 4.0); // 默认各0.25；有准则权重时在组装处加权

        // 各维度评价依据与不满足规则的数据项摘要（报告直接引用）
        r.details.put("sampling", samplingNote(sample.size(), requestSize, version));
        r.details.put("qcom", String.format("实际抽样%d行x%d列：空值单元格 %d/%d（非空率 %.2f%%）%s",
                sample.size(), sample.get(0).size(), totalCells - nonNullCells, totalCells, qcom,
                topSummary(qcomFailures, "缺失最多的列")));
        r.details.put("qcon", String.format("重复行 %d/%d（整行唯一率 %.2f%%）",
                duplicateRows, sample.size(), qcon));
        r.details.put("qtim", String.format("最新记录距 %.1f 天（数据年龄惩罚每日-2分）", ageDays));
        r.details.put("qval", String.format("有效性未通过 %d/%d 单元格（%.2f%%通过）%s",
                totalCells - validCells, totalCells, qval,
                topSummary(qvalFailures, "主要问题")));
        r.details.put("sampleSize", sample.size());
        r.details.put("requestSize", requestSize);
        r.details.put("rowCount", version.getRowCount());
        return r;
    }

    /** 抽样说明：解释"实际抽样/请求/登记行数"的关系，避免误解抽样参数失效 */
    private static String samplingNote(int actual, int request, DatasetVersionEntity version) {
        String base = String.format("实际抽样 %d 行（请求 %d 行", actual, request);
        if (version.getRowCount() != null && version.getRowCount() > 0) {
            base += String.format("；数据集登记 %d 行", version.getRowCount());
            if (actual < request) {
                base += "，实际可查询行数少于请求抽样行数";
            }
        }
        return base + "）";
    }

    /** 聚合未通过项摘要：按次数倒序取前5，格式 "主要问题: 列 规则xN, 列 规则xN"；无失败返回空串 */
    private static String topSummary(Map<String, Long> failures, String label) {
        if (failures.isEmpty()) {
            return "；" + label + ": 无";
        }
        List<Map.Entry<String, Long>> top = failures.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .collect(java.util.stream.Collectors.toList());
        StringBuilder sb = new StringBuilder("；").append(label).append(": ");
        for (int i = 0; i < top.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append(top.get(i).getKey()).append("×").append(top.get(i).getValue());
        }
        return sb.toString();
    }

    private List<Map<String, Object>> sampleData(String storagePath, int size) {
        try {
            String sql = String.format("select * from %s LIMIT %d;", storagePath, size);
            SessionExecuteSqlResult res = iginxSession.executeSql(sql);
            return ConvertUtil.getRecords(res);
        } catch (Exception e) {
            log.warn("抽样查询失败 storagePath={}: {}", storagePath, e.getMessage());
            return Collections.emptyList();
        }
    }

    /** 有效性-语义规则（取值范围/枚举/业务约束）：返回 null 表示通过，否则返回规则名称用于原因标注 */
    private String accurateRuleFailed(String column, Object value) {
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) return null;
        String lower = column.toLowerCase();
        if (lower.contains("confidence") || lower.contains("score") || lower.contains("weight")) {
            try {
                double d = Double.parseDouble(s);
                return (d >= 0 && d <= 1) ? null : "取值越界(应在0~1)";
            } catch (NumberFormatException e) {
                return "应为数值";
            }
        }
        if (lower.contains("count") || lower.contains("num") || lower.endsWith("_id") || lower.equals("id")) {
            // 编号列允许 字母/数字/下划线/连字符（如 sample_id: fault_diagnosis-000123）；count/num 列仍须纯数字
            if (lower.endsWith("_id") || lower.equals("id")) {
                return s.matches("[A-Za-z0-9_\\-]+") ? null : "编号格式非法";
            }
            return s.matches("\\d+") ? null : "计数应为非负整数";
        }
        // 数值型的物理量（温度/压力/转速/推力等）不应为负
        if (lower.matches(".*(temp|pressure|speed|rpm|thrust|flow|rate).*")) {
            try {
                return Double.parseDouble(s) >= 0 ? null : "物理量为负";
            } catch (NumberFormatException ignore) {
                // 非数值文本列不适用本规则
            }
        }
        return null;
    }

    /** 有效性-格式规则（日期/编号模式/空格/控制字符）：返回 null 表示通过，否则返回规则名称 */
    private String conformantRuleFailed(String column, Object value) {
        String s = String.valueOf(value);
        if (s.isEmpty()) return "空值";
        String lower = column.toLowerCase();
        if (lower.contains("time") || lower.contains("date")) {
            return parseTime(lower, s.trim()) != null ? null : "日期不可解析";
        }
        if (s.length() != s.trim().length()) return "含首尾空格";
        return s.chars().anyMatch(c -> c < 9 || (c > 13 && c < 32)) ? "含控制字符" : null;
    }

    private String findTimeColumn(Map<String, Object> row) {
        for (String k : row.keySet()) {
            String lower = shortName(k).toLowerCase();
            for (String t : TIME_COLUMNS) {
                if (lower.equals(t) || lower.endsWith("_" + t)) return k;
            }
        }
        return null;
    }

    private Long parseTime(String column, Object value) {
        if (value == null || column == null) return null;
        if (value instanceof Number) return ((Number) value).longValue();
        String s = String.valueOf(value).trim();
        String[] patterns = {"yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss", "yyyy/MM/dd"};
        for (String p : patterns) {
            try {
                return new SimpleDateFormat(p).parse(s).getTime();
            } catch (ParseException ignore) {
            }
        }
        return null;
    }

    /** 列名去掉路径前缀，如 "datasets.a.b.col" -> "col" */
    private static String shortName(String path) {
        if (path == null) return "";
        int idx = path.lastIndexOf('.');
        return idx >= 0 ? path.substring(idx + 1) : path;
    }

    private static double round(double d) {
        return Math.round(d * 10) / 10.0;
    }

    private static JSONObject parseJson(String json) {
        if (json == null || json.isEmpty()) return new JSONObject();
        try {
            JSONObject obj = JSONObject.parseObject(json);
            return obj != null ? obj : new JSONObject();
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static Double toDouble(Object o) {
        if (o == null) return null;
        try {
            return Double.parseDouble(o.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
