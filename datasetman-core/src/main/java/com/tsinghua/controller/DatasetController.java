package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.CategoryStatDTO;
import com.tsinghua.dto.DatasetChangeProcessDTO;
import com.tsinghua.dto.DatasetCreateRequest;
import com.tsinghua.dto.DatasetRelationDTO;
import com.tsinghua.dto.DatasetRequest;
import com.tsinghua.dto.DatasetTreeDTO;
import com.tsinghua.dto.ImpactAnalysisDTO;
import com.tsinghua.dto.LineageGraphDTO;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.entity.DatasetEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.DatasetCategoryService;
import com.tsinghua.service.DatasetCreationService;
import com.tsinghua.service.DatasetManifestService;
import com.tsinghua.service.DatasetService;
import com.tsinghua.service.DatasetVersionService;
import com.tsinghua.service.ImpactAnalysisService;
import com.tsinghua.service.LineageService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "数据集管理")
@Slf4j
@RestController
@RequestMapping("/api/dataset")
public class DatasetController {

    @Autowired
    private DatasetService datasetService;

    @Autowired
    private DatasetVersionService datasetVersionService;

    @Autowired
    private DatasetCreationService datasetCreationService;

    @Autowired
    private LineageService lineageService;

    @Autowired
    private DatasetCategoryService datasetCategoryService;

    @Autowired
    private ImpactAnalysisService impactAnalysisService;

    @Autowired
    private DatasetManifestService datasetManifestService;

    @Autowired
    private com.tsinghua.service.DatasetExportService datasetExportService;

    @ApiOperation("测试SQL")
    @PostMapping("/testsql")
    @RequirePermission(Permission.UPDATE)
    @OperationLog(value = "测试SQL", type = OperationLog.OperationType.UPDATE)
    public Result<Object> testSQL(@RequestParam String sql) {
        return Result.success(datasetService.testSQL(sql));
    }

    @ApiOperation("保存数据集")
    @PostMapping("/save")
    @RequirePermission(Permission.UPDATE)
    @OperationLog(value = "保存数据集", type = OperationLog.OperationType.UPDATE)
    public Result<DatasetEntity> saveDataset(@Validated @RequestBody DatasetRequest request) {
        return Result.success(datasetService.saveDataset(request));
    }

    @ApiOperation("数据集详情")
    @GetMapping( "/metas")
    @RequirePermission(Permission.READ)
    public Result<DatasetEntity> queryMeta(
            @RequestParam("path") String path) throws Exception {
        DatasetEntity result = datasetService.queryMeta(path);
        return Result.success(result);
    }

    @ApiOperation("删除数据集")
    @DeleteMapping( "/delete")
    @RequirePermission(Permission.DELETE)
    public Result<Void> deleteDataset(
            @RequestParam("path") String path) throws Exception {
        datasetService.deleteDataset(path);
        return Result.success("删除成功");
    }

    @ApiOperation("向导式创建数据集版本")
    @PostMapping("/create")
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "创建数据集版本", type = OperationLog.OperationType.CREATE)
    public Result<DatasetVersionEntity> create(@Validated @RequestBody DatasetCreateRequest request) throws Exception {
        return Result.success(datasetCreationService.create(request));
    }

    @ApiOperation("数据集名称和版本树")
    @GetMapping("/tree")
    @RequirePermission(Permission.READ)
    public Result<List<DatasetTreeDTO>> tree() {
        return Result.success(datasetVersionService.getDatasetTree());
    }

    @ApiOperation("数据集版本详情")
    @GetMapping("/version/metas")
    @RequirePermission(Permission.READ)
    public Result<DatasetVersionEntity> versionMeta(@RequestParam("versionId") Long versionId) {
        return Result.success(datasetVersionService.queryVersion(versionId));
    }

    @ApiOperation("数据集变化过程表格")
    @GetMapping("/changes")
    @RequirePermission(Permission.READ)
    public Result<List<DatasetChangeProcessDTO>> changes(@RequestParam("datasetName") String datasetName) {
        return Result.success(lineageService.getChangeProcess(datasetName));
    }

    @ApiOperation("数据集血缘图谱")
    @GetMapping("/lineage")
    @RequirePermission(Permission.READ)
    public Result<LineageGraphDTO> lineage(
            @RequestParam("versionId") Long versionId,
            @RequestParam(value = "sideLineage", defaultValue = "true") boolean sideLineage) {
        return Result.success(lineageService.getLineageGraph(versionId, sideLineage));
    }

    @ApiOperation("删除数据集版本")
    @DeleteMapping("/version/delete")
    @RequirePermission(Permission.DELETE)
    public Result<Void> deleteVersion(@RequestParam("versionId") Long versionId) {
        datasetVersionService.softDeleteVersion(versionId);
        return Result.success("删除成功");
    }

    @ApiOperation("启用/禁用数据集版本")
    @PutMapping("/version/toggle")
    @RequirePermission(Permission.UPDATE)
    @OperationLog(value = "启用/禁用数据集版本", type = OperationLog.OperationType.UPDATE)
    public Result<Boolean> toggleVersion(@RequestBody java.util.Map<String, Object> body) {
        Long versionId = Long.valueOf(body.get("versionId").toString());
        boolean disabled = datasetVersionService.toggleVersion(versionId);
        return Result.success(disabled ? "已禁用" : "已启用", disabled);
    }

    @ApiOperation("更新数据集版本档案")
    @PutMapping("/version/update")
    @RequirePermission(Permission.UPDATE)
    @OperationLog(value = "编辑数据集档案", type = OperationLog.OperationType.UPDATE)
    public Result<Void> updateVersion(@RequestBody java.util.Map<String, Object> body) {
        Long versionId = Long.valueOf(body.get("versionId").toString());
        String remark = body.get("remark") != null ? body.get("remark").toString() : null;
        String dataModality = body.get("dataType") != null ? body.get("dataType").toString() : null;
        String category = body.get("category") != null ? body.get("category").toString() : null;
        String tags = body.get("tags") != null ? body.get("tags").toString() : null;
        datasetVersionService.updateVersion(versionId, remark, dataModality, category, tags);
        return Result.success("更新成功");
    }

    // ====================================================================
    // 场景分类管理与关系提取
    // ====================================================================

    @ApiOperation("11类场景分类统计")
    @GetMapping("/categories")
    @RequirePermission(Permission.READ)
    public Result<List<CategoryStatDTO>> categoryStats() {
        return Result.success(datasetCategoryService.categoryStats());
    }

    @ApiOperation("按场景分类查询数据集")
    @GetMapping("/by-category")
    @RequirePermission(Permission.READ)
    public Result<List<DatasetVersionEntity>> byCategory(@RequestParam("category") String category) {
        return Result.success(datasetCategoryService.datasetsByCategory(category));
    }

    @ApiOperation("数据集关系提取（派生自/同源/同场景）")
    @GetMapping("/relations")
    @RequirePermission(Permission.READ)
    public Result<List<DatasetRelationDTO>> relations(
            @RequestParam(value = "datasetName", required = false) String datasetName) {
        return Result.success(datasetCategoryService.extractRelations(datasetName));
    }

    // ====================================================================
    // 影响范围分析 / 标准化导出
    // ====================================================================

    @ApiOperation("影响范围分析：下游受影响数据集与版本链")
    @GetMapping("/impact")
    @RequirePermission(Permission.READ)
    public Result<ImpactAnalysisDTO> impact(@RequestParam("versionId") Long versionId) {
        return Result.success(impactAnalysisService.analyze(versionId));
    }

    @ApiOperation("打包导出数据集：全部版本数据表CSV + manifest清单 + 质量评估报告PDF")
    @PostMapping("/export-package")
    @RequirePermission(Permission.READ)
    @OperationLog(value = "导出标准数据集包", type = OperationLog.OperationType.EXPORT)
    public void exportPackage(@RequestParam("versionId") Long versionId,
                              javax.servlet.http.HttpServletResponse response) throws Exception {
        DatasetVersionEntity version = datasetVersionService.queryVersion(versionId);
        byte[] zip = datasetExportService.exportPackage(versionId);
        String fileName = datasetExportService.buildFileName(
                version != null ? version.getDatasetName() : "dataset",
                version != null ? version.getVersionNo() : null);
        response.setContentType("application/zip");
        response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''"
                + java.net.URLEncoder.encode(fileName, "UTF-8").replace("+", "%20"));
        response.getOutputStream().write(zip);
    }

}
