package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.KnowledgeGraphQueryRequest;
import com.tsinghua.entity.KnowledgeGraphEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.KnowledgeGraphService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 知识图谱管理
 * 管理neo4j知识图谱：节点/关系CSV上传入库、分页列表、名称存在检测、图数据查询解析（供G6可视化）。
 */
@Api(tags = "知识图谱管理")
@Slf4j
@RestController
@RequestMapping("/api/knowledge-graph")
public class KnowledgeGraphController {

    @Autowired
    private KnowledgeGraphService knowledgeGraphService;

    @ApiOperation("上传知识图谱（节点/关系CSV入库到knowledge_graphs.<图谱名称>.nodes/.edges）")
    @PostMapping("/upload")
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "上传知识图谱", type = OperationLog.OperationType.CREATE)
    public Result<KnowledgeGraphEntity> uploadGraph(
            @RequestParam("name") String name,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam("nodesFile") MultipartFile nodesFile,
            @RequestParam("edgesFile") MultipartFile edgesFile) {
        return Result.success(knowledgeGraphService.uploadGraph(name, description, nodesFile, edgesFile));
    }

    @ApiOperation("分页查询知识图谱")
    @PostMapping("/query")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "分页查询知识图谱", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<List<KnowledgeGraphEntity>> queryGraphs(@RequestBody KnowledgeGraphQueryRequest request) {
        return Result.success(knowledgeGraphService.queryGraphs(request));
    }

    @ApiOperation("查询知识图谱总数")
    @PostMapping("/count")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "查询知识图谱总数", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<Long> countGraphs(@RequestBody KnowledgeGraphQueryRequest request) {
        return Result.success(knowledgeGraphService.countGraphs(request.getName()));
    }

    @ApiOperation("图谱名称存在检测（同名且未删除视为已存在）")
    @GetMapping("/validate-name")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "检测知识图谱名称", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<Boolean> validateName(@RequestParam("name") String name) {
        return Result.success(knowledgeGraphService.nameExists(name));
    }

    @ApiOperation("知识图谱图数据（增量分页，供G6渲染）")
    @GetMapping("/data")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "查询知识图谱图数据", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<Map<String, Object>> graphData(
            @RequestParam("name") String name,
            @RequestParam(value = "nodeOffset", required = false, defaultValue = "0") Integer nodeOffset,
            @RequestParam(value = "nodeLimit", required = false, defaultValue = "300") Integer nodeLimit) {
        return Result.success(knowledgeGraphService.getGraphData(name, nodeOffset, nodeLimit));
    }
}
