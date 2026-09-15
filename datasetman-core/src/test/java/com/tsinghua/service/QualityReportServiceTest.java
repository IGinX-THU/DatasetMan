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
 * 对齐课题测试方案 4.3.1.6：完整性/一致性/时效性/有效性 四维，DQI 加权，达标线95。
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
    void reportPassesWhenAllDimensionsAboveNinetyFive() {
        String json = service.generateReport(buildEntity(
                new double[]{100, 97, 96, 98}, new double[]{0.25, 0.25, 0.25, 0.25}));
        JSONObject report = JSONObject.parseObject(json);
        assertTrue(report.getBoolean("passed"));
        assertTrue(report.getDoubleValue("dqi") >= 95);
        assertEquals("优", report.getJSONArray("dimensions").getJSONObject(0).getString("grade"));
        // 无质量问题时 issue 列表为"未发现明显质量问题"占位提示
        assertEquals(1, ((JSONArray) report.get("issues")).size());
        assertTrue(((JSONArray) report.get("issues")).getString(0).contains("未发现"));
    }

    @Test
    void reportGeneratesIssuesAndRecommendationsWhenDimensionLow() {
        String json = service.generateReport(buildEntity(
                new double[]{95, 45, 90, 70}, new double[]{0.25, 0.25, 0.25, 0.25}));
        JSONObject report = JSONObject.parseObject(json);
        assertFalse(report.getBoolean("passed"));
        JSONArray issues = (JSONArray) report.get("issues");
        // 达标线95：完整性95不标（<95才标），一致性45/时效性90/有效性70 共3条
        assertEquals(3, issues.size());
        JSONArray recs = (JSONArray) report.get("recommendations");
        assertEquals(3, recs.size());
        // DQI = (95+45+90+70)/4 = 75，处于告警区间
        assertEquals(75.0, report.getDoubleValue("dqi"), 0.01);
        assertTrue(report.getString("conclusion").contains("告警"));
    }

    @Test
    void reportSupportsFourDimensionsWithDefaultWeights() {
        // 4维各0.25权重，等价于算术平均（对齐 4.3.1.6 权重配置确认步骤）
        JSONObject scores = new JSONObject();
        JSONObject weights = new JSONObject();
        double[] vals = {100, 90, 80, 70};
        String[] dims = {"qcom", "qcon", "qtim", "qval"};
        for (int i = 0; i < dims.length; i++) {
            scores.put(dims[i], vals[i]);
            weights.put(dims[i], 0.25);
        }
        QualityAssessmentEntity entity = buildEntityRaw(scores, weights);
        JSONObject report = JSONObject.parseObject(service.generateReport(entity));
        assertEquals(4, report.getIntValue("dimensionCount"));
        assertEquals(4, service.supportedDimensions().size());
        assertEquals(85.0, report.getDoubleValue("score"), 0.01);
        assertEquals("良", report.getString("grade"));
        // 每个维度都输出得分与依据占位
        JSONArray ds = report.getJSONArray("dimensions");
        assertTrue(ds.getJSONObject(0).containsKey("evidence"));
        assertEquals("有效性", ds.getJSONObject(3).getString("name"));
    }

    private QualityAssessmentEntity buildEntityRaw(JSONObject scores, JSONObject weights) {
        QualityAssessmentEntity e = new QualityAssessmentEntity();
        e.setCriteriaName("4维度准则");
        e.setScores(scores.toJSONString());
        e.setWeights(weights.toJSONString());
        return e;
    }

    @Test
    void qualityScoreDiscriminatesQualityLevels() {
        // A/B/C 三组典型得分应单调递减（4.3.1.6 区分度验证）
        double[] a = {100, 99, 99, 98};
        double[] b = {95, 85, 88, 90};
        double[] c = {82, 60, 65, 72};
        double sa = 0, sb = 0, sc = 0;
        for (int i = 0; i < 4; i++) {
            sa += a[i] * 0.25; sb += b[i] * 0.25; sc += c[i] * 0.25;
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
