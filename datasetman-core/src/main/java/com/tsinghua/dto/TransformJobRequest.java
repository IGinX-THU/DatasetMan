package com.tsinghua.dto;

import lombok.Data;

import java.util.List;

@Data
public class TransformJobRequest {
    private Long createTime;
    private String name;
    private List<TaskInfoDto> taskList;
    private Integer exportType;
    private String exportFile;
    private String schedule;
}
