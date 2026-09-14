package com.tsinghua.enums;

/**
 * 航空发动机设计、制造、试验、运维阶段的11类智能体典型研发场景分类。
 */
public enum SceneCategoryEnum {

    OVERALL_DESIGN("overall_design", "总体方案设计", "design", "总体性能方案论证、循环参数匹配、总体结构布局"),
    AERODYNAMIC("aerodynamic", "气动性能设计", "design", "叶栅气动设计、特性计算、流场仿真结果标注"),
    STRUCTURE("structure", "结构强度设计", "design", "轮盘/叶片强度校核、振动与寿命分析"),
    COMBUSTION("combustion", "燃烧室设计", "design", "燃烧组织、喷嘴设计、排放与出口温度分布"),
    CONTROL("control", "控制系统设计", "design", "控制律设计、FADEC逻辑、故障模式与保护策略"),
    MANUFACTURE("manufacturing", "制造工艺", "manufacturing", "工艺路线、切削参数、典型件加工经验"),
    ASSEMBLY("assembly", "装配检测", "manufacturing", "装配工艺、间隙测量、动平衡与无损检测"),
    GROUND_TEST("ground_test", "试车试验", "test", "台架试车、高空模拟、性能与适航验证试验"),
    FAULT_DIAGNOSIS("fault_diagnosis", "故障诊断", "operations", "故障树、气路诊断、滑油金属屑与孔探检查"),
    HEALTH_MGMT("health_mgmt", "健康管理", "operations", "性能衰退趋势、寿命管理、视情维修决策"),
    OANDM("oandm", "运维保障", "operations", "外场维护、单元体更换、航线排故经验");

    private final String code;
    private final String label;
    private final String stage;
    private final String description;

    SceneCategoryEnum(String code, String label, String stage, String description) {
        this.code = code;
        this.label = label;
        this.stage = stage;
        this.description = description;
    }

    public static SceneCategoryEnum of(String code) {
        for (SceneCategoryEnum e : values()) {
            if (e.code.equalsIgnoreCase(code) || e.label.equals(code) || e.name().equalsIgnoreCase(code)) {
                return e;
            }
        }
        throw new IllegalArgumentException("未知的场景分类: " + code);
    }

    /**
     * 解析逗号分隔的多场景分类（一个数据集可覆盖多类场景），逐个校验并归一化为标准编码。
     */
    public static String normalizeMulti(String codes) {
        if (codes == null || codes.trim().isEmpty()) {
            return "";
        }
        String[] parts = codes.split("[,，]");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part.trim().isEmpty()) continue;
            if (sb.length() > 0) sb.append(',');
            sb.append(of(part.trim()).getCode());
        }
        return sb.toString();
    }

    /** 判断某版本的多场景分类中是否包含指定场景 */
    public static boolean contains(String multiCodes, String code) {
        if (multiCodes == null || multiCodes.isEmpty()) return false;
        for (String part : multiCodes.split("[,，]")) {
            if (part.trim().equalsIgnoreCase(code)) return true;
        }
        return false;
    }

    public String getCode() { return code; }
    public String getLabel() { return label; }
    public String getStage() { return stage; }
    public String getDescription() { return description; }
}
