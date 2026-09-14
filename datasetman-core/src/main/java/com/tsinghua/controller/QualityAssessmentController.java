package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.QualityAssessmentQueryRequest;
import com.tsinghua.dto.QualityAssessmentRequest;
import com.tsinghua.entity.QualityAssessmentEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.QualityAssessmentService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "质量测评")
@RestController
@RequestMapping("/api/quality-assessment")
public class QualityAssessmentController {

    @Autowired
    private QualityAssessmentService qualityAssessmentService;

    @Autowired
    private com.tsinghua.service.QualityReportService qualityReportService;

    @Autowired
    private com.tsinghua.service.QualityDetectionService qualityDetectionService;

    @ApiOperation("保存质量测评记录")
    @PostMapping("/save")
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "保存质量测评记录", type = OperationLog.OperationType.CREATE)
    public Result<QualityAssessmentEntity> saveAssessment(@RequestBody QualityAssessmentRequest request) throws Exception {
        return Result.success(qualityAssessmentService.saveAssessment(request));
    }

    @ApiOperation("分页查询质量测评记录")
    @PostMapping("/query")
    @RequirePermission(Permission.READ)
    public Result<List<QualityAssessmentEntity>> queryAssessments(@RequestBody QualityAssessmentQueryRequest request) {
        return Result.success(qualityAssessmentService.queryAssessments(request));
    }

    @ApiOperation("查询质量测评记录总数")
    @PostMapping("/count")
    @RequirePermission(Permission.READ)
    public Result<Object> countAssessments(@RequestBody QualityAssessmentQueryRequest request) {
        return Result.success(qualityAssessmentService.countAssessments(request));
    }

    @ApiOperation("查询质量测评记录详情")
    @GetMapping("/detail")
    @RequirePermission(Permission.READ)
    public Result<QualityAssessmentEntity> queryById(@RequestParam("id") Long id) {
        QualityAssessmentEntity result = qualityAssessmentService.queryById(id);
        if (result == null) {
            return Result.error("未找到指定的质量测评记录");
        }
        return Result.success(result);
    }

    @ApiOperation("删除质量测评记录")
    @DeleteMapping("/delete")
    @RequirePermission(Permission.DELETE)
    @OperationLog(value = "删除质量测评记录", type = OperationLog.OperationType.DELETE)
    public Result<Void> deleteAssessment(@RequestParam("id") Long id) {
        qualityAssessmentService.deleteAssessment(id);
        return Result.success("操作成功");
    }

    @ApiOperation("系统支持的质量测评维度列表（5个维度，默认权重各20%）")
    @GetMapping("/dimensions")
    @RequirePermission(Permission.READ)
    public Result<List<java.util.Map<String, Object>>> dimensions() {
        return Result.success(qualityReportService.supportedDimensions());
    }

    @ApiOperation("质量自动检测：对数据集版本实际数据抽样检测并自动生成测评记录与报告")
    @PostMapping("/auto-detect")
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "质量自动检测", type = OperationLog.OperationType.CREATE)
    public Result<QualityAssessmentEntity> autoDetect(@RequestParam("versionId") Long versionId,
                                                       @RequestParam(value = "sampleSize", required = false) Integer sampleSize) {
        return Result.success("检测完成", qualityDetectionService.autoDetect(versionId, sampleSize));
    }

    @ApiOperation("获取自动生成的质量评估报告（已存报告为空时即时生成）")
    @GetMapping("/report")
    @RequirePermission(Permission.READ)
    public Result<String> report(@RequestParam("id") Long id) {
        QualityAssessmentEntity entity = qualityAssessmentService.queryById(id);
        if (entity == null) {
            return Result.error("未找到指定的质量测评记录");
        }
        if (entity.getReportJson() == null || entity.getReportJson().isEmpty()) {
            return Result.success("成功", qualityReportService.generateReport(entity));
        }
        return Result.success("成功", entity.getReportJson());
    }
}
