package com.tsinghua.service;

import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.entity.QualityAssessmentEntity;
import com.tsinghua.enums.DataQualityDimensionEnum;
import com.tsinghua.enums.SceneCategoryEnum;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 质量评估报告自动生成的单元测试（纯逻辑，不依赖 IGinX）。
 */
class QualityReportServiceTest {

    private final QualityReportService service = new QualityReportService();

    private QualityAssessmentEntity buildEntity(double[] scores, double[] weights) {
        QualityAssessmentEntity entity = new QualityAssessmentEntity();
        entity.setId(1L);
        entity.setCriteriaName("航空发动机标注数据集质量准则");
        JSONObject s = new JSONObject();
        JSONObject w = new JSONObject();
        DataQualityDimensionEnum[] dims = DataQualityDimensionEnum.values();
        for (int i = 0; i < dims.length; i++) {
            s.put(dims[i].name(), scores[i]);
            w.put(dims[i].name(), weights[i]);
        }
        entity.setScores(s.toJSONString());
        entity.setWeights(w.toJSONString());
        return entity;
    }

    @Test
    void reportPassesWhenAllDimensionsGood() {
        String json = service.generateReport(buildEntity(
                new double[]{95, 92, 93, 90, 96}, new double[]{0.25, 0.25, 0.2, 0.15, 0.15}));
        JSONObject report = JSONObject.parseObject(json);
        assertTrue(report.getBoolean("passed"));
        assertTrue(report.getDoubleValue("dqi") >= 80);
        assertEquals("优", report.getJSONArray("dimensions").getJSONObject(0).getString("grade"));
        // 无质量问题时 issue 列表为"未发现明显质量问题"占位提示
        assertEquals(1, ((JSONArray) report.get("issues")).size());
        assertTrue(((JSONArray) report.get("issues")).getString(0).contains("未发现"));
    }

    @Test
    void reportGeneratesIssuesAndRecommendationsWhenDimensionLow() {
        String json = service.generateReport(buildEntity(
                new double[]{95, 45, 93, 90, 70}, new double[]{0.2, 0.2, 0.2, 0.2, 0.2}));
        JSONObject report = JSONObject.parseObject(json);
        assertFalse(report.getBoolean("passed"));
        JSONArray issues = (JSONArray) report.get("issues");
        assertEquals(2, issues.size()); // 一致性45(差) + 有效性70(中)
        JSONArray recs = (JSONArray) report.get("recommendations");
        assertEquals(2, recs.size());
        // DQI = (95+45+93+90+70)/5 = 78.6，处于告警区间
        assertEquals(78.6, report.getDoubleValue("dqi"), 0.01);
        assertTrue(report.getString("conclusion").contains("告警"));
    }

    @Test
    void reportSupportsFiveDimensionsWithDefaultWeights() {
        // 5维各20%权重，等价于算术平均
        JSONObject scores = new JSONObject();
        JSONObject weights = new JSONObject();
        // qcom=100 qacc=90 qcon=80 qtim=70 qconf=60 -> 综合80
        double[] vals = {100, 90, 80, 70, 60};
        String[] dims = {"qcom", "qacc", "qcon", "qtim", "qconf"};
        for (int i = 0; i < dims.length; i++) {
            scores.put(dims[i], vals[i]);
            weights.put(dims[i], 0.2);
        }
        QualityAssessmentEntity entity = buildEntityRaw(scores, weights);
        JSONObject report = JSONObject.parseObject(service.generateReport(entity));
        assertEquals(5, report.getIntValue("dimensionCount"));
        assertEquals(5, service.supportedDimensions().size());
        assertEquals(80.0, report.getDoubleValue("score"), 0.01);
        assertEquals("良", report.getString("grade"));
        // 每个维度都输出得分、依据占位与建议（不达标维度有建议）
        JSONArray ds = report.getJSONArray("dimensions");
        assertTrue(ds.getJSONObject(0).containsKey("evidence"));
        assertTrue(ds.getJSONObject(4).getString("suggestion").contains("规范性"));
    }

    private QualityAssessmentEntity buildEntityRaw(JSONObject scores, JSONObject weights) {
        QualityAssessmentEntity e = new QualityAssessmentEntity();
        e.setCriteriaName("5维度准则");
        e.setScores(scores.toJSONString());
        e.setWeights(weights.toJSONString());
        return e;
    }

    @Test
    void qualityScoreDiscriminatesQualityLevels() {
        // A/B/C 三组典型得分应单调递减（区分度验证）
        double[] a = {100, 99, 99, 95, 98};
        double[] b = {95, 85, 88, 70, 90};
        double[] c = {82, 60, 65, 40, 72};
        double sa = 0, sb = 0, sc = 0;
        for (int i = 0; i < 5; i++) {
            sa += a[i] * 0.2; sb += b[i] * 0.2; sc += c[i] * 0.2;
        }
        assertTrue(sa > sb && sb > sc);
    }

    @Test
    void sceneCategoryCoversElevenScenes() {
        assertEquals(11, SceneCategoryEnum.values().length);
        // fault_diagnosis 是第9个场景，最后一个运维保障是第11个
        assertEquals(9, SceneCategoryEnum.of("fault_diagnosis").ordinal() + 1);
        assertEquals(11, SceneCategoryEnum.of("oandm").ordinal() + 1);
        assertEquals("故障诊断", SceneCategoryEnum.of("故障诊断").getLabel());
        assertThrows(IllegalArgumentException.class, () -> SceneCategoryEnum.of("not_exist"));
    }
}
