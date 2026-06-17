package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.DatasetRequest;
import com.tsinghua.entity.DatasetEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.DatasetService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "数据集管理")
@Slf4j
@RestController
@RequestMapping("/api/dataset")
public class DatasetController {

    @Autowired
    private DatasetService datasetService;

    @ApiOperation("测试SQL")
    @PostMapping("/testsql")
    @RequirePermission(Permission.UPDATE)
    @OperationLog(value = "测试SQL", type = OperationLog.OperationType.UPDATE)
    public Result<Object> testSQL(@RequestParam String sql) {
        return Result.success(datasetService.testSQL(sql));
    }

    @ApiOperation("保存数据集")
    @PostMapping("/save")
    @RequirePermission(Permission.UPDATE)
    @OperationLog(value = "保存数据集", type = OperationLog.OperationType.UPDATE)
    public Result<DatasetEntity> saveDataset(@Validated @RequestBody DatasetRequest request) {
        return Result.success(datasetService.saveDataset(request));
    }

    @ApiOperation("数据集详情")
    @GetMapping( "/metas")
    @RequirePermission(Permission.READ)
    public Result<DatasetEntity> queryMeta(
            @RequestParam("path") String path) throws Exception {
        DatasetEntity result = datasetService.queryMeta(path);
        return Result.success(result);
    }

    @ApiOperation("删除数据集")
    @DeleteMapping( "/delete")
    @RequirePermission(Permission.DELETE)
    public Result<Void> deleteDataset(
            @RequestParam("path") String path) throws Exception {
        datasetService.deleteDataset(path);
        return Result.success("删除成功");
    }

    @ApiOperation("版本历史")
    @GetMapping("/history")
    @RequirePermission(Permission.READ)
    public Result<List<com.tsinghua.dto.DatasetVersionTreeDTO>> getVersionHistory(
            @RequestParam("datasetName") String datasetName) throws Exception {
        List<com.tsinghua.dto.DatasetVersionTreeDTO> result = datasetService.getVersionHistory(datasetName);
        return Result.success(result);
    }

}
