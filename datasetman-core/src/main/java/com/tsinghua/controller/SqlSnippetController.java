package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.SqlSnippetRequest;
import com.tsinghua.entity.SqlSnippetEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.SqlSnippetService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * SQL片段管理
 * 独立管理的可复用SQL列表资源，供transform编排和数据集版本生产引用。
 */
@Api(tags = "SQL片段管理")
@Slf4j
@RestController
@RequestMapping("/api/sql-snippet")
public class SqlSnippetController {

    @Autowired
    private SqlSnippetService sqlSnippetService;

    @ApiOperation("保存SQL片段（新建或编辑）")
    @PostMapping("/save")
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "保存SQL片段", type = OperationLog.OperationType.CREATE)
    public Result<SqlSnippetEntity> saveSnippet(@Validated @RequestBody SqlSnippetRequest request) {
        return Result.success(sqlSnippetService.saveSnippet(request));
    }

    @ApiOperation("SQL片段列表（支持名称模糊查询）")
    @GetMapping("/list")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "查询SQL片段列表", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<List<SqlSnippetEntity>> listSnippets(
            @RequestParam(value = "name", required = false) String name) {
        return Result.success(sqlSnippetService.listSnippets(name));
    }

    @ApiOperation("SQL片段详情")
    @GetMapping("/metas")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "查询SQL片段详情", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<SqlSnippetEntity> queryById(@RequestParam("id") Long id) {
        SqlSnippetEntity entity = sqlSnippetService.queryById(id);
        return Result.success(entity);
    }

    @ApiOperation("删除SQL片段")
    @DeleteMapping("/delete")
    @RequirePermission(Permission.DELETE)
    @OperationLog(value = "删除SQL片段", type = OperationLog.OperationType.DELETE)
    public Result<Void> deleteSnippet(@RequestParam("id") Long id) {
        sqlSnippetService.deleteSnippet(id);
        return Result.success("删除成功");
    }
}
