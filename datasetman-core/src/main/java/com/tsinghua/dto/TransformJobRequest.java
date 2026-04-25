package com.tsinghua.dto;

import lombok.Data;

import java.util.List;

@Data
public class TransformJobRequest {
    private String name;
    private List<TaskInfoDto> taskList;
    private String exportFiletName;
    private String schedule;
}
