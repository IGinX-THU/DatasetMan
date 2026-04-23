package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.DatasetRequest;
import com.tsinghua.entity.DatasetEntity;
import com.tsinghua.entity.ModelMetaEntity;
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

    @ApiOperation("测试SQL")
    @PostMapping("/testsql")
    @RequirePermission(Permission.MODEL_UPDATE)
    @OperationLog(value = "测试SQL", type = OperationLog.OperationType.UPDATE)
    public Result<Object> testSQL(@Validated @RequestBody DatasetRequest request) {
        return Result.success(datasetService.testSQL(request.getDatasetSql()));
    }

    @ApiOperation("保存数据集")
    @PostMapping("/save")
    @RequirePermission(Permission.MODEL_UPDATE)
    @OperationLog(value = "保存数据集", type = OperationLog.OperationType.UPDATE)
    public Result<Void> saveDataset(@Validated @RequestBody DatasetRequest request) {
        datasetService.saveDataset(request);
        return Result.success("保存成功");
    }

    @ApiOperation("数据集详情")
    @GetMapping( "/metas")
    @RequirePermission(Permission.MODEL_READ)
    public Result<DatasetEntity> queryMeta(
            @RequestParam("path") String path) throws Exception {
        DatasetEntity result = datasetService.queryMeta(path);
        return Result.success(result);
    }

    @ApiOperation("删除数据集")
    @DeleteMapping( "/delete")
    @RequirePermission(Permission.MODEL_READ)
    public Result<Void> deleteDataset(
            @RequestParam("path") String path) throws Exception {
        datasetService.deleteDataset(path);
        return Result.success("删除成功");
    }

}
