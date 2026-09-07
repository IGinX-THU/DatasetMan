package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.DatasetChangeProcessDTO;
import com.tsinghua.dto.DatasetCreateRequest;
import com.tsinghua.dto.DatasetRequest;
import com.tsinghua.dto.DatasetTreeDTO;
import com.tsinghua.dto.LineageGraphDTO;
import com.tsinghua.entity.DatasetEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.DatasetCreationService;
import com.tsinghua.service.DatasetService;
import com.tsinghua.service.DatasetVersionService;
import com.tsinghua.service.LineageService;
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

    @Autowired
    private DatasetVersionService datasetVersionService;

    @Autowired
    private DatasetCreationService datasetCreationService;

    @Autowired
    private LineageService lineageService;

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

    @ApiOperation("向导式创建数据集版本")
    @PostMapping("/create")
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "创建数据集版本", type = OperationLog.OperationType.CREATE)
    public Result<DatasetVersionEntity> create(@Validated @RequestBody DatasetCreateRequest request) throws Exception {
        return Result.success(datasetCreationService.create(request));
    }

    @ApiOperation("数据集名称和版本树")
    @GetMapping("/tree")
    @RequirePermission(Permission.READ)
    public Result<List<DatasetTreeDTO>> tree() {
        return Result.success(datasetVersionService.getDatasetTree());
    }

    @ApiOperation("数据集版本详情")
    @GetMapping("/version/metas")
    @RequirePermission(Permission.READ)
    public Result<DatasetVersionEntity> versionMeta(@RequestParam("versionId") Long versionId) {
        return Result.success(datasetVersionService.queryVersion(versionId));
    }

    @ApiOperation("数据集变化过程表格")
    @GetMapping("/changes")
    @RequirePermission(Permission.READ)
    public Result<List<DatasetChangeProcessDTO>> changes(@RequestParam("datasetId") Long datasetId) {
        return Result.success(lineageService.getChangeProcess(datasetId));
    }

    @ApiOperation("数据集血缘图谱")
    @GetMapping("/lineage")
    @RequirePermission(Permission.READ)
    public Result<LineageGraphDTO> lineage(
            @RequestParam("versionId") Long versionId,
            @RequestParam(value = "sideLineage", defaultValue = "true") boolean sideLineage) {
        return Result.success(lineageService.getLineageGraph(versionId, sideLineage));
    }

    @ApiOperation("删除数据集版本")
    @DeleteMapping("/version/delete")
    @RequirePermission(Permission.DELETE)
    public Result<Void> deleteVersion(@RequestParam("versionId") Long versionId) {
        datasetVersionService.softDeleteVersion(versionId);
        return Result.success("删除成功");
    }

}
