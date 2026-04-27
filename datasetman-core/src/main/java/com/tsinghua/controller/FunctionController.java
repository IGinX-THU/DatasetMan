package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.RegisterTaskInfoDto;
import com.tsinghua.dto.StorageEngineInfoDto;
import com.tsinghua.model.Result;
import com.tsinghua.service.FunctionService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Api(tags = "函数管理")
@RestController
@RequestMapping("/api/function")
public class FunctionController {

    @Autowired
    private FunctionService functionService;

    @ApiOperation("注册Transform")
    @PostMapping(value = "/register/transform", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequirePermission(Permission.FUNCTION_CREATE)
    @OperationLog(value = "注册Transform", type = OperationLog.OperationType.CREATE, recordParams = false)
    public Result<?> registerTransform(
            @RequestPart("file") MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam("className") String className) throws Exception {

        if (file.isEmpty()) {
            return Result.error("上传文件不能为空。");
        }

        functionService.registerTransform(file, name, className);
        return Result.success("注册成功");
    }

    @ApiOperation("移除函数")
    @DeleteMapping( "/delete/{name}")
    @RequirePermission(Permission.FUNCTION_DELETE)
    @OperationLog(value = "移除函数", type = OperationLog.OperationType.DELETE)
    public Result<Void> handleDelete(
            @PathVariable("name") String name) throws Exception {
        functionService.delete(name);
        return Result.success("操作成功");
    }


    @ApiOperation("函数列表")
    @GetMapping("/query/{type}")
    @RequirePermission(Permission.FUNCTION_READ)
    @OperationLog(value = "查询函数列表", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<List<RegisterTaskInfoDto>> list(@PathVariable("type") String type) throws Exception {
        return Result.success(functionService.query(type));
    }

    @ApiOperation("注册UDF")
    @PostMapping(value = "/register/udf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequirePermission(Permission.FUNCTION_CREATE)
    @OperationLog(value = "注册UDF", type = OperationLog.OperationType.CREATE, recordParams = false)
    public Result<?> registerUDF(
            @RequestPart("file") MultipartFile file,
            @RequestParam("name") String udfName,
            @RequestParam("className") String className,
            @RequestParam("udfType") String udfType) throws Exception {

        if (file.isEmpty()) {
            return Result.error("上传文件不能为空。");
        }

        functionService.registerUDF(file, udfName, className, udfType);
        return Result.success("注册成功");
    }

}
