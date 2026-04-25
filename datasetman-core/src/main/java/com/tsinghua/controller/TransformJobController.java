package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.TransformJobRequest;
import com.tsinghua.entity.TransformJobEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.TransformJobService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
