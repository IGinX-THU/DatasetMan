package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.UploadResult;
import com.tsinghua.model.Result;
import com.tsinghua.service.TransformService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Api(tags = "Transform管理")
@RestController
@RequestMapping("/api/transform")
public class TransformController {

    @Autowired
    private TransformService transformService;

    @ApiOperation("注册Transform")
    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequirePermission(Permission.MODEL_CREATE)
    @OperationLog(value = "注册Transform", type = OperationLog.OperationType.CREATE, recordParams = false)
    public Result<?> register(
            @RequestPart("file") MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam("className") String className) throws Exception {

        if (file.isEmpty()) {
            return Result.error("上传文件不能为空。");
        }

        transformService.register(file, name, className);
        return Result.success("注册成功");
    }

    @ApiOperation("移除Transform")
    @DeleteMapping( "/delete/{name}")
    @RequirePermission(Permission.MODEL_DELETE)
    @OperationLog(value = "移除Transform", type = OperationLog.OperationType.DELETE)
    public Result<Void> handleDelete(
            @PathVariable("name") String name) throws Exception {
        transformService.delete(name);
        return Result.success("操作成功");
    }

}
