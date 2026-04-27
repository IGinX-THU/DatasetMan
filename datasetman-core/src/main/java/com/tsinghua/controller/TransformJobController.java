package com.tsinghua.controller;

import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.TransformJobQueryRequest;
import com.tsinghua.entity.TransformJobEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.TransformJobService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "Transform任务管理")
@RestController
@RequestMapping("/api/transform-job")
public class TransformJobController {

    @Autowired
    private TransformJobService transformJobService;

    @ApiOperation("分页查询Transform作业")
    @PostMapping("/query")
    @RequirePermission(Permission.TRANSFORM_JOB_READ)
    public Result<List<TransformJobEntity>> queryJobs(@RequestBody TransformJobQueryRequest request) {
        List<TransformJobEntity> result = transformJobService.queryJobs(request);
        return Result.success(result);
    }

    @ApiOperation("查询Transform作业总数")
    @PostMapping("/count")
    @RequirePermission(Permission.TRANSFORM_JOB_READ)
    public Result<Object> countJobs(@RequestBody TransformJobQueryRequest request) {
        Object count = transformJobService.countJobs(request);
        return Result.success(count);
    }

    @ApiOperation("查询Transform作业详情")
    @GetMapping("/detail/{jobId}")
    @RequirePermission(Permission.TRANSFORM_JOB_READ)
    public Result<?> queryJob(@PathVariable("jobId") String jobId) {
        TransformJobEntity result = transformJobService.queryJob(jobId);
        if (result == null) {
            return Result.error("未找到指定的作业");
        }
        return Result.success(result);
    }

    @ApiOperation("提交任务")
    @PutMapping("/commit/{createTime}")
    @RequirePermission(Permission.TRANSFORM_JOB_UPDATE)
    public Result<?> commitJob(@PathVariable("createTime") Long createTime) throws Exception {
        TransformJobEntity result = transformJobService.commitJob(createTime);
        return Result.success("任务已提交", result);
    }

    @ApiOperation("刷新任务状态")
    @GetMapping("/status/{jobId}")
    @RequirePermission(Permission.TRANSFORM_JOB_READ)
    public Result<?> statusJob(@PathVariable("jobId") String jobId) throws Exception {
        TransformJobEntity result = transformJobService.statusJob(jobId);
        return Result.success(result);
    }

    @ApiOperation("取消任务")
    @PutMapping("/cancel/{jobId}")
    @RequirePermission(Permission.TRANSFORM_JOB_UPDATE)
    public Result<?> cancelJob(@PathVariable("jobId") String jobId) throws Exception {
        TransformJobEntity result = transformJobService.cancelJob(jobId);
        return Result.success(result);
    }

    @ApiOperation("血缘图谱")
    @GetMapping( "/bloodline")
    @RequirePermission(Permission.TRANSFORM_JOB_READ)
    public Result<List<TransformJobEntity>> chartBloodline (
            @RequestParam("datasetPath") String datasetPath,
            @RequestParam(value = "sideLineage", defaultValue = "true") Boolean sideLineage) throws Exception {
        List<TransformJobEntity> result = transformJobService.queryAllJobs(datasetPath, null, sideLineage);
        return Result.success(result);
    }

}
