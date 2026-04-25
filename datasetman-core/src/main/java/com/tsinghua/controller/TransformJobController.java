package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.TransformJobQueryRequest;
import com.tsinghua.dto.TransformJobRequest;
import com.tsinghua.entity.TransformJobEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.TransformJobService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "Transform 作业")
@RestController
@RequestMapping("/api/job")
public class TransformJobController {

    @Autowired
    private TransformJobService transformJobService;

    @ApiOperation("编排Transform作业")
    @PostMapping("/save")
    @RequirePermission(Permission.RUN_TASK_CREATE)
    @OperationLog(value = "保存Transform作业", type = OperationLog.OperationType.CREATE)
    public Result<TransformJobEntity> saveTransform(@RequestBody TransformJobRequest runTaskRequest) throws Exception {
        return Result.success(transformJobService.saveTransform(runTaskRequest));
    }

    @ApiOperation("分页查询Transform作业")
    @PostMapping("/query")
    @RequirePermission(Permission.RUN_TASK_READ)
    public Result<List<TransformJobEntity>> queryJobs(@RequestBody TransformJobQueryRequest request) {
        List<TransformJobEntity> result = transformJobService.queryJobs(request);
        return Result.success(result);
    }

    @ApiOperation("查询Transform作业总数")
    @PostMapping("/count")
    @RequirePermission(Permission.RUN_TASK_READ)
    public Result<Object> countJobs(@RequestBody TransformJobQueryRequest request) {
        Object count = transformJobService.countJobs(request);
        return Result.success(count);
    }

    @ApiOperation("查询Transform作业详情")
    @GetMapping("/detail")
    @RequirePermission(Permission.RUN_TASK_READ)
    public Result<?> queryJob(@RequestParam("id") Long id) {
        TransformJobEntity result = transformJobService.queryJob(id);
        if (result == null) {
            return Result.error("未找到指定的作业");
        }
        return Result.success(result);
    }

    @ApiOperation("删除Transform作业")
    @DeleteMapping("/delete")
    @RequirePermission(Permission.RUN_TASK_DELETE)
    @OperationLog(value = "删除Transform作业", type = OperationLog.OperationType.DELETE)
    public Result<Void> deleteJob(@RequestParam("id") Long id) throws Exception {
        transformJobService.deleteJob(id);
        return Result.success("操作成功");
    }
}
