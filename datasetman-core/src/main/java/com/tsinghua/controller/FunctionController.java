package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.RegisterTaskInfoDto;
import com.tsinghua.entity.FunctionArchiveEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.FunctionArchiveService;
import com.tsinghua.service.FunctionService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Api(tags = "函数管理")
@RestController
@RequestMapping("/api/function")
public class FunctionController {

    @Autowired
    private FunctionService functionService;

    @Autowired
    private FunctionArchiveService functionArchiveService;

    @ApiOperation("注册Transform")
    @PostMapping(value = "/register/transform", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "注册Transform", type = OperationLog.OperationType.CREATE, recordParams = false)
    public Result<?> registerTransform(
            @RequestPart("file") MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam("className") String className,
            @RequestParam(value = "desc", required = false) String desc) throws Exception {

        if (file.isEmpty()) {
            return Result.error("上传文件不能为空。");
        }

        functionService.registerTransform(file, name, className);

        // 参考数据档案：注册成功后保存函数档案（说明等冗余信息）
        saveFunctionArchive(name, "transform", null, className, file.getOriginalFilename(), desc);
        return Result.success("注册成功");
    }

    @ApiOperation("移除函数")
    @DeleteMapping( "/delete/{name}")
    @RequirePermission(Permission.DELETE)
    @OperationLog(value = "移除函数", type = OperationLog.OperationType.DELETE)
    public Result<Void> handleDelete(
            @PathVariable("name") String name) throws Exception {
        functionService.delete(name);

        // 同步清理函数档案（id列可能映射不到，回退用createTime，与数据档案删除保持一致）
        try {
            FunctionArchiveEntity archive = functionArchiveService.findByName(name);
            if (archive != null) {
                Long archiveId = archive.getId() != null ? archive.getId() : archive.getCreateTime();
                functionArchiveService.deleteArchive(archiveId);
            }
        } catch (Exception e) {
            log.warn("清理函数档案失败: {}", e.getMessage());
        }
        return Result.success("操作成功");
    }


    @ApiOperation("函数列表（含函数档案中的说明）")
    @GetMapping("/query/{type}")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "查询函数列表", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<List<RegisterTaskInfoDto>> list(@PathVariable("type") String type) throws Exception {
        List<RegisterTaskInfoDto> functions = functionService.query(type);

        // 二次查询函数档案，按函数名回填说明
        try {
            String archiveType = "transform".equalsIgnoreCase(type) ? "transform"
                    : ("udf".equalsIgnoreCase(type) ? "udf" : null);
            Map<String, String> descMap = new HashMap<>();
            for (FunctionArchiveEntity archive : functionArchiveService.queryArchives(archiveType, null, null, null)) {
                descMap.put(archive.getName(), archive.getDesc());
            }
            functions.forEach(f -> f.setDesc(descMap.get(f.getName())));
        } catch (Exception e) {
            log.warn("回填函数说明失败: {}", e.getMessage());
        }

        return Result.success(functions);
    }

    @ApiOperation("更新函数说明")
    @PostMapping("/archive/update")
    @RequirePermission(Permission.UPDATE)
    @OperationLog(value = "更新函数说明", type = OperationLog.OperationType.UPDATE)
    public Result<?> updateArchiveDesc(@RequestBody Map<String, String> body) throws Exception {
        String name = body.get("name");
        if (!StringUtils.hasText(name)) {
            return Result.error("函数名称不能为空");
        }
        String desc = body.getOrDefault("desc", "");
        String type = body.getOrDefault("type", "");
        String archiveType = "udf".equalsIgnoreCase(type) ? "udf" : "transform";
        functionArchiveService.updateDesc(name.trim(), archiveType, desc);
        return Result.success("保存成功");
    }

    @ApiOperation("注册UDF")
    @PostMapping(value = "/register/udf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "注册UDF", type = OperationLog.OperationType.CREATE, recordParams = false)
    public Result<?> registerUDF(
            @RequestPart("file") MultipartFile file,
            @RequestParam("name") String udfName,
            @RequestParam("className") String className,
            @RequestParam("udfType") String udfType,
            @RequestParam(value = "desc", required = false) String desc) throws Exception {

        if (file.isEmpty()) {
            return Result.error("上传文件不能为空。");
        }

        functionService.registerUDF(file, udfName, className, udfType);

        // 参考数据档案：注册成功后保存函数档案（说明等冗余信息）
        saveFunctionArchive(udfName, "udf", udfType, className, file.getOriginalFilename(), desc);
        return Result.success("注册成功");
    }

    @ApiOperation("下载函数文件")
    @GetMapping("/download/{type}/{fileName}")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "下载函数文件", type = OperationLog.OperationType.QUERY, recordParams = false)
    public ResponseEntity<Resource> downloadFunction(
            @PathVariable("type") String type,
            @PathVariable("fileName") String fileName) throws Exception {

        Resource resource = functionService.downloadFunction(fileName, type);

        String contentType = "application/octet-stream";
        String headerValue = "attachment; filename=\"" + resource.getFilename() + "\"";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, headerValue)
                .body(resource);
    }

    private void saveFunctionArchive(String name, String type, String udfType, String className, String fileName, String desc) {
        try {
            FunctionArchiveEntity archive = functionArchiveService.findByName(name);
            if (archive == null) {
                archive = new FunctionArchiveEntity().setName(name);
            }
            archive.setType(type);
            if (StringUtils.hasText(udfType)) {
                archive.setUdfType(udfType);
            }
            archive.setClassName(className);
            if (StringUtils.hasText(fileName)) {
                archive.setFileName(fileName);
            }
            if (StringUtils.hasText(desc)) {
                archive.setDesc(desc.trim());
            }
            functionArchiveService.saveArchive(archive);
        } catch (Exception e) {
            // 注册本身已成功，档案保存失败仅记录，不影响主流程
            log.warn("保存函数档案失败: {}", e.getMessage());
        }
    }

}
