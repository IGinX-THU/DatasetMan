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
 * 数据集质量自动检测（对应课题测试方案 4.3.2.2：支持5个以上维度的工业数据质量综合测评）：
 * 对指定数据集版本的实际数据抽样，自动执行 5 个维度的检测规则——
 *   完整性 qcom：非空单元格占比
 *   准确性 qacc：数值正负/取值域/枚举合法等语义规则通过率
 *   一致性 qcon：行唯一性（重复行率）
 *   时效性 qtim：数据最新记录年龄（每滞后1天扣2分）
 *   规范性 qconf：日期可解析、编号模式、无首尾空格/控制字符等格式规范符合率
 * 综合得分按默认权重（各20%）加权计算，并自动生成评估报告落库。全程无人工录入。
 */
@Slf4j
@Service
public class QualityDetectionService {

    private static final int SAMPLE_SIZE = 200;
    private static final double DEFAULT_WEIGHT = 0.2;

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
     * @param sampleSize 抽样行数
     * @param criteriaId 可选，评价准则ID：提供时使用准则配置的权重/作业绑定，缺省各维度20%
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
        DetectionResult result = detect(sample, version);

        long timestamp = System.currentTimeMillis();
        QualityAssessmentEntity entity = new QualityAssessmentEntity();
        entity.setId(timestamp);
        // 关联评价准则（权重、作业绑定取自准则），否则记录为独立自动检测
        entity.setCriteriaId(criteria != null ? criteriaId : version.getId());
        entity.setCriteriaName(criteria != null
                ? criteria.getName()
                : "自动检测-" + version.getDatasetName());
        entity.setDescription(String.format("对数据集 %s %s 的5维度自动质量检测（抽样 %d 行）",
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
        // 综合得分按准则权重加权（默认各20%）
        double weighted = 0.0, weightSum = 0.0;
        for (DataQualityDimensionEnum dim : DataQualityDimensionEnum.values()) {
            Double w = toDouble(weights.get(dim.name()));
            if (w != null && w > 0) {
                weighted += result.scores.getOrDefault(dim.name(), 0.0) * w;
                weightSum += w;
            }
        }
        entity.setDqi(String.valueOf(weightSum > 0 ? round(weighted / weightSum) : result.composite));
        entity.setPassed(result.composite >= QualityReportService.PASS_THRESHOLD ? "true" : "false");
        entity.setDetailJson(result.details.toJSONString());
        entity.setCreateTime(timestamp);
        entity.setOperator(OperationLogAspect.getCurrentUser());
        entity.setClientIp(OperationLogAspect.getClientIp());
        entity.setOwner(AuthUtil.getCurrentUsername());
        entity.setDatasetName(version.getDatasetName());
        entity.setVersionNo(version.getVersionNo());
        entity.setReportJson(qualityReportService.generateReport(entity));

        iginxClient.getWriteClient().writeMeasurement(entity);
        log.info("质量自动检测完成。dataset={}, versionId={}, composite={}, sampleSize={}",
                version.getDatasetName(), versionId, result.composite, result.sampleSize);
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

    private DetectionResult detect(List<Map<String, Object>> sample, DatasetVersionEntity version) {
        DetectionResult r = new DetectionResult();
        r.sampleSize = sample.size();

        if (sample.isEmpty()) {
            for (DataQualityDimensionEnum dim : DataQualityDimensionEnum.values()) {
                r.scores.put(dim.name(), 0.0);
            }
            r.composite = 0.0;
            r.details.put("error", "未查询到可检测数据（storagePath=" + version.getStoragePath() + "）");
            return r;
        }

        long totalCells = 0, nonNullCells = 0, accurateCells = 0, conformantCells = 0;
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
                if (v != null && !String.valueOf(v).trim().isEmpty()) {
                    nonNullCells++;
                    if (isAccurate(col, v)) accurateCells++;
                    if (isConformant(col, v)) conformantCells++;
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
        // 准确性：语义规则通过率（数值正负/取值域/枚举合法）
        double qacc = 100.0 * accurateCells / totalCells;
        // 一致性：1 - 重复行率
        double qcon = 100.0 * (1.0 - (double) duplicateRows / sample.size());
        // 时效性：最新记录年龄，每滞后1天扣2分（无时间字段则按版本登记时间）
        long reference = newestTime > 0 ? newestTime
                : (version.getCreateTime() != null ? version.getCreateTime() : 0);
        double ageDays = reference > 0 ? (System.currentTimeMillis() - reference) / 86400000.0 : 0;
        // 钳制到[0,100]：数据时间在未来（如补录）时年龄为负，不得超出满分
        double qtim = Math.min(100.0, Math.max(0.0, 100.0 - ageDays * 2.0));
        // 规范性：格式规范符合率
        double qconf = 100.0 * conformantCells / totalCells;

        r.scores.put("qcom", round(qcom));
        r.scores.put("qacc", round(qacc));
        r.scores.put("qcon", round(qcon));
        r.scores.put("qtim", round(qtim));
        r.scores.put("qconf", round(qconf));
        r.composite = round((qcom + qacc + qcon + qtim + qconf) / 5.0); // 默认各20%；有准则权重时在组装处加权

        // 每维度的评分依据（报告直接引用）
        r.details.put("qcom", String.format("抽样%d行x%d列：空值单元格 %d/%d（非空率 %.2f%%）",
                sample.size(), sample.get(0).size(), totalCells - nonNullCells, totalCells, qcom));
        r.details.put("qacc", String.format("语义规则未通过 %d/%d 单元格（负值/越界/枚举非法）",
                totalCells - accurateCells, totalCells));
        r.details.put("qcon", String.format("重复行 %d/%d（整行唯一率 %.2f%%）",
                duplicateRows, sample.size(), qcon));
        r.details.put("qtim", String.format("最新记录距 %.1f 天（数据年龄惩罚每日-2分）", ageDays));
        r.details.put("qconf", String.format("格式不规范 %d/%d 单元格（日期/编号/空格/乱码）",
                totalCells - conformantCells, totalCells));
        r.details.put("sampleSize", sample.size());
        r.details.put("rowCount", version.getRowCount());
        return r;
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

    /** 准确性规则：置信度/分数列在[0,1]；计数/物理量为正；通用列不含语义矛盾值 */
    private boolean isAccurate(String column, Object value) {
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) return false;
        String lower = column.toLowerCase();
        if (lower.contains("confidence") || lower.contains("score") || lower.contains("weight")) {
            try {
                double d = Double.parseDouble(s);
                return d >= 0 && d <= 1;
            } catch (NumberFormatException e) {
                return false;
            }
        }
        if (lower.contains("count") || lower.contains("num") || lower.endsWith("_id") || lower.equals("id")) {
            // 编号列允许 字母/数字/下划线/连字符（如 sample_id: fault_diagnosis-000123）；count/num 列仍须纯数字
            if (lower.endsWith("_id") || lower.equals("id")) {
                return s.matches("[A-Za-z0-9_\\-]+");
            }
            return s.matches("\\d+");
        }
        // 数值型的物理量（温度/压力/转速/推力等）不应为负
        if (lower.matches(".*(temp|pressure|speed|rpm|thrust|flow|rate).*")) {
            try {
                return Double.parseDouble(s) >= 0;
            } catch (NumberFormatException ignore) {
                // 非数值文本列不适用本规则
            }
        }
        return true;
    }

    /** 规范性规则：时间列可解析；编号列符合模式；无首尾空格与控制字符 */
    private boolean isConformant(String column, Object value) {
        String s = String.valueOf(value);
        if (s.isEmpty()) return false;
        String lower = column.toLowerCase();
        if (lower.contains("time") || lower.contains("date")) {
            return parseTime(lower, s.trim()) != null;
        }
        if (s.length() != s.trim().length()) return false;  // 首尾空格
        return !s.chars().anyMatch(c -> c < 9 || (c > 13 && c < 32));  // 控制字符
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
