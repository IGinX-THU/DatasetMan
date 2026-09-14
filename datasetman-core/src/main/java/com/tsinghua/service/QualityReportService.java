package com.tsinghua.service;

import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.entity.QualityAssessmentEntity;
import com.tsinghua.enums.DataQualityDimensionEnum;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 质量评估报告自动生成：
 * 依据测评记录自动生成结构化评估报告。维度无关：按 scores 中实际存在的维度遍历
 * （当前支持完整性/准确性/一致性/时效性/规范性共5维，默认权重各20%），
 * 报告含各维度得分、评分依据、改进建议、综合得分（加权）与综合质量等级。
 */
@Slf4j
@Service
public class QualityReportService {

    public static final double PASS_THRESHOLD = 80.0;
    public static final double WARN_THRESHOLD = 60.0;

    /** 由测评记录自动生成报告（JSON 结构），不依赖人工填写 */
    public String generateReport(QualityAssessmentEntity entity) {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("title", "数据集质量评估报告");
        report.put("assessmentId", entity.getId());
        report.put("criteriaId", entity.getCriteriaId());
        report.put("criteriaName", entity.getCriteriaName());
        report.put("createTime", entity.getCreateTime());
        report.put("operator", entity.getOperator());

        JSONObject scores = parse(entity.getScores());
        JSONObject weights = parse(entity.getWeights());
        JSONObject jobIds = parse(entity.getJobIds());
        JSONObject details = parse(entity.getDetailJson());

        // 1. 各维度评分明细（含得分、依据、建议）
        List<Map<String, Object>> dimensions = new ArrayList<>();
        List<String> issues = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();
        double weightedSum = 0.0;
        double weightTotal = 0.0;

        for (String dimCode : scores.keySet()) {
            DataQualityDimensionEnum dim = dimOf(dimCode);
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("code", dimCode);
            d.put("name", dim != null ? dim.getLabel() : dimCode);
            double score = toDouble(scores.get(dimCode), -1);
            double weight = toDouble(weights.get(dimCode), 0);
            d.put("score", score);
            d.put("weight", weight);
            d.put("jobId", jobIds.get(dimCode));
            d.put("grade", grade(score));
            // 评分依据：自动检测写入的明细（如空值计数、重复行数、数据年龄）
            Object evidence = details.get(dimCode);
            d.put("evidence", evidence != null ? evidence : "");
            d.put("suggestion", score >= 0 && score < PASS_THRESHOLD ? recommend(dimCode, score) : "");
            dimensions.add(d);

            if (score >= 0 && weight > 0) {
                weightedSum += score * weight;
                weightTotal += weight;
            }
            if (score >= 0 && score < PASS_THRESHOLD) {
                issues.add(String.format("【%s】得分 %.1f（%s）", dimName(dimCode), score, grade(score)));
                recommendations.add(recommend(dimCode, score));
            }
        }
        report.put("dimensionCount", dimensions.size());
        report.put("dimensions", dimensions);

        // 2. 综合得分（权重加权，默认各20%）
        double dqi = weightTotal > 0 ? weightedSum / weightTotal : toDouble(entity.getDqi(), -1);
        dqi = Math.round(dqi * 10) / 10.0;
        report.put("score", dqi);
        report.put("dqi", dqi);
        report.put("grade", overallGrade(dqi));
        report.put("passed", dqi >= PASS_THRESHOLD);
        report.put("conclusion", dqi >= PASS_THRESHOLD
                ? "综合质量指数达标（等级：" + overallGrade(dqi) + "），数据集可投入共享使用。"
                : dqi >= WARN_THRESHOLD
                ? "综合质量指数处于告警区间（等级：" + overallGrade(dqi) + "），建议整改后复评。"
                : "综合质量指数未达标（等级：" + overallGrade(dqi) + "），数据集不建议共享使用，需整改后重新评估。");

        // 3. 问题明细与整改建议
        report.put("issues", issues.isEmpty() ? listOf("未发现明显质量问题") : issues);
        report.put("recommendations",
                recommendations.isEmpty() ? listOf("继续保持现有数据治理流程") : recommendations);

        // 4. 评分依据（关联的检测作业与导出文件）
        report.put("evidenceJobs", parse(entity.getJobs()));
        report.put("evidenceExportFiles", parse(entity.getExportFiles()));
        report.put("detectionDetails", details);

        return JSONObject.toJSONString(report);
    }

    /** 系统支持的测评维度列表（对应测试方案4.3.2.2步骤1：维度数量确认） */
    public List<Map<String, Object>> supportedDimensions() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (DataQualityDimensionEnum dim : DataQualityDimensionEnum.values()) {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("code", dim.name());
            d.put("name", dim.getLabel());
            d.put("english", dim.getEnglish());
            d.put("rule", dim.getRule());
            d.put("defaultWeight", 0.2);
            list.add(d);
        }
        return list;
    }

    public static String overallGrade(double score) {
        if (score >= 90) return "优";
        if (score >= 80) return "良";
        if (score >= 70) return "中";
        if (score >= 60) return "及格";
        return "差";
    }

    private static String grade(double score) {
        if (score < 0) return "未评估";
        if (score >= PASS_THRESHOLD) return "优";
        if (score >= WARN_THRESHOLD) return "中";
        return "差";
    }

    private static String dimName(String code) {
        DataQualityDimensionEnum dim = dimOf(code);
        return dim != null ? dim.getLabel() : code;
    }

    private static DataQualityDimensionEnum dimOf(String code) {
        try {
            return DataQualityDimensionEnum.valueOf(code);
        } catch (Exception e) {
            return null;
        }
    }

    private static String recommend(String code, double score) {
        String base;
        DataQualityDimensionEnum dim = dimOf(code);
        if (dim == null) return "整改后复评";
        switch (dim) {
            case qcom: base = "补充缺失字段与空值记录，复核数据接入链路的断点重传策略"; break;
            case qacc: base = "清洗越界/矛盾取值，复核采集端量程与单位换算配置"; break;
            case qcon: base = "去重并统一跨源字段口径与编码规范，重新执行一致性校对作业"; break;
            case qtim: base = "缩短数据同步周期，检查采集链路延迟与积压"; break;
            case qconf: base = "按格式规范（日期/编号模式/编码）清洗数据，完善入库校验规则"; break;
            default: base = "整改后复评";
        }
        return score < WARN_THRESHOLD
                ? String.format("【%s】紧急整改：%s。", dim.getLabel(), base)
                : String.format("【%s】建议优化：%s。", dim.getLabel(), base);
    }

    private static JSONObject parse(String json) {
        if (json == null || json.isEmpty()) return new JSONObject();
        try {
            JSONObject obj = JSONObject.parseObject(json);
            return obj != null ? obj : new JSONObject();
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static double toDouble(Object o, double def) {
        if (o == null) return def;
        try {
            return Double.parseDouble(o.toString());
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static List<String> listOf(String s) {
        List<String> list = new ArrayList<>();
        list.add(s);
        return list;
    }
}
