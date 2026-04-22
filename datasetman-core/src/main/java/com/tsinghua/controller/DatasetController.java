package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.DatasetRequest;
import com.tsinghua.model.Result;
import com.tsinghua.service.DatasetService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Api(tags = "数据集管理")
@Slf4j
@RestController
@RequestMapping("/api/dataset")
public class DatasetController {

    @Autowired
    private DatasetService datasetService;

    @ApiOperation("保存数据集")
    @PostMapping("/save")
    @RequirePermission(Permission.MODEL_UPDATE)
    @OperationLog(value = "保存模型元数据", type = OperationLog.OperationType.UPDATE)
    public Result<Void> saveDataset(@Validated @RequestBody DatasetRequest request) {
        datasetService.saveDataset(request);
        return Result.success("保存成功");
    }

    @ApiOperation("测试SQL")
    @PostMapping("/testsql")
    @RequirePermission(Permission.MODEL_UPDATE)
    @OperationLog(value = "测试SQL", type = OperationLog.OperationType.UPDATE)
    public Result<Object> testSQL(@Validated @RequestBody DatasetRequest request) {
        return Result.success(datasetService.testSQL(request.getDatasetSql()));
    }
}
