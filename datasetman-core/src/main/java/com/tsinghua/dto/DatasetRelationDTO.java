package com.tsinghua.dto;

import lombok.Data;

/**
 * 数据集间自动提取的关系。
 * relationType: derived_from（派生自）/ same_source（同源）/ same_type（同类型关联）
 */
@Data
public class DatasetRelationDTO {

    public static final String DERIVED_FROM = "derived_from";
    public static final String SAME_SOURCE = "same_source";
    public static final String SAME_TYPE = "same_type";

    private String fromDataset;
    private String toDataset;
    private String relationType;
    private String relationLabel;
    /** 提取依据（血缘边 / 共享上游 / 场景分类） */
    private String evidence;

    public static DatasetRelationDTO of(String from, String to, String type, String evidence) {
        DatasetRelationDTO dto = new DatasetRelationDTO();
        dto.setFromDataset(from);
        dto.setToDataset(to);
        dto.setRelationType(type);
        switch (type) {
            case DERIVED_FROM: dto.setRelationLabel("派生自"); break;
            case SAME_SOURCE: dto.setRelationLabel("同源"); break;
            case SAME_TYPE: dto.setRelationLabel("同类型关联"); break;
            default: dto.setRelationLabel(type);
        }
        dto.setEvidence(evidence);
        return dto;
    }
}
