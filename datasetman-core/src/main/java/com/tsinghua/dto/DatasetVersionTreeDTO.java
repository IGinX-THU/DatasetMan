package com.tsinghua.dto;

import lombok.Data;
import java.util.List;

@Data
public class DatasetVersionTreeDTO {
    private String id;
    private String name;
    private String time;
    private Long timestamp;
    private Long parent;
    private String color;
    private String user;
    private String ip;
    private String sql;
    private String remark;
    private Boolean deleted;
    private List<DatasetVersionTreeDTO> children;
}
