package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.KnowledgeGraphQueryRequest;
import com.tsinghua.dto.KnowledgeGraphUploadRequest;
import com.tsinghua.entity.KnowledgeGraphEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.KnowledgeGraphService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

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

    @ApiOperation("上传知识图谱（节点/关系CSV经LOAD导入knowledge_graphs.<图谱名称>.nodes/.edges）")
    @PostMapping("/upload")
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "上传知识图谱", type = OperationLog.OperationType.CREATE)
    public Result<KnowledgeGraphEntity> uploadGraph(@Validated @RequestBody KnowledgeGraphUploadRequest request) {
        return Result.success(knowledgeGraphService.uploadGraph(request));
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

    @ApiOperation("知识图谱抽样视图（按标签分层抽样，供G6初始渲染）")
    @GetMapping("/sample")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "查询知识图谱抽样视图", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<Map<String, Object>> graphSample(
            @RequestParam("name") String name,
            @RequestParam(value = "size", required = false, defaultValue = "150") Integer size) {
        return Result.success(knowledgeGraphService.getGraphSample(name, size));
    }

    @ApiOperation("节点邻接扩展（一跳邻居，供双击展开）")
    @GetMapping("/neighbors")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "查询节点邻接", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<Map<String, Object>> graphNeighbors(
            @RequestParam("name") String name,
            @RequestParam("nodeId") String nodeId,
            @RequestParam(value = "limit", required = false, defaultValue = "50") Integer limit) {
        return Result.success(knowledgeGraphService.getNeighbors(name, nodeId, limit));
    }

    @ApiOperation("知识图谱图数据（mode=page增量分页 / mode=full全量一次查询）")
    @GetMapping("/data")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "查询知识图谱图数据", type = OperationLog.OperationType.QUERY, recordResult = false)
    public Result<Map<String, Object>> graphData(
            @RequestParam("name") String name,
            @RequestParam(value = "mode", required = false, defaultValue = "page") String mode,
            @RequestParam(value = "nodeOffset", required = false, defaultValue = "0") Integer nodeOffset,
            @RequestParam(value = "nodeLimit", required = false, defaultValue = "1000") Integer nodeLimit) {
        if ("full".equalsIgnoreCase(mode)) {
            return Result.success(knowledgeGraphService.getGraphDataFull(name));
        }
        return Result.success(knowledgeGraphService.getGraphData(name, nodeOffset, nodeLimit));
    }
}
