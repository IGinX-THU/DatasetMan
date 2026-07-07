package com.tsinghua.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ColumnDto {
    private String path;
    /**
     *     BOOLEAN(0),
     *     INTEGER(1),
     *     LONG(2),
     *     FLOAT(3),
     *     DOUBLE(4),
     *     BINARY(5);
     */
    private int dataType;
    /**
     * time_series（时序数据）
     * file_system（文件数据）
     * relational（关系数据）
     * semi_structured（半结构化数据）
     * key_value（键值数据）
     */
    private String dataModality;

}
