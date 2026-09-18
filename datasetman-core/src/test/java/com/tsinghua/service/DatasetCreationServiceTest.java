package com.tsinghua.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DatasetCreationServiceTest {

    @Test
    void transformFilePreviewUsesSamePathRuleAsCreation() {
        assertEquals("file_system.sys_data.job.result\\csv", 
                DatasetCreationService.buildTransformOutputPath(1, "C:/output/result.csv"));
        assertEquals("transform", DatasetCreationService.buildTransformOutputPath(2, "ignored.csv"));
    }

    @Test
    void nonFileTransformPreviewUsesTransformRoot() {
        assertEquals("transform", DatasetCreationService.buildTransformOutputPath(0, null));
    }
}
