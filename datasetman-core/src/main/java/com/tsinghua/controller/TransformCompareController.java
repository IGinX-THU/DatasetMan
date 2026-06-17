package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.TransformJobQueryRequest;
import com.tsinghua.dto.TransformJobRequest;
import com.tsinghua.entity.TransformCompareEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.TransformCompareService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "编排Transform 作业")
@RestController
@RequestMapping("/api/transform-compare")
public class TransformCompareController {

    @Autowired
    private TransformCompareService transformCompareService;

    @ApiOperation("编排Transform作业")
    @PostMapping("/save")
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "保存Transform作业", type = OperationLog.OperationType.CREATE)
    public Result<TransformCompareEntity> saveTransform(@RequestBody TransformJobRequest request) throws Exception {
        return Result.success(transformCompareService.saveTransform(request));
    }

    @ApiOperation("分页查询Transform作业")
    @PostMapping("/query")
    @RequirePermission(Permission.READ)
    public Result<List<TransformCompareEntity>> queryJobs(@RequestBody TransformJobQueryRequest request) {
        List<TransformCompareEntity> result = transformCompareService.queryJobs(request);
        return Result.success(result);
    }

    @ApiOperation("查询Transform作业总数")
    @PostMapping("/count")
    @RequirePermission(Permission.READ)
    public Result<Object> countJobs(@RequestBody TransformJobQueryRequest request) {
        Object count = transformCompareService.countJobs(request);
        return Result.success(count);
    }

    @ApiOperation("查询Transform作业详情")
    @GetMapping("/detail")
    @RequirePermission(Permission.READ)
    public Result<?> queryJob(@RequestParam("createTime") Long createTime) {
        TransformCompareEntity result = transformCompareService.queryJob(createTime);
        if (result == null) {
            return Result.error("未找到指定的作业");
        }
        return Result.success(result);
    }

    @ApiOperation("删除Transform作业")
    @DeleteMapping("/delete")
    @RequirePermission(Permission.DELETE)
    @OperationLog(value = "删除Transform作业", type = OperationLog.OperationType.DELETE)
    public Result<Void> deleteJob(@RequestParam("createTime") Long createTime) throws Exception {
        transformCompareService.deleteJob(createTime);
        return Result.success("操作成功");
    }
}
