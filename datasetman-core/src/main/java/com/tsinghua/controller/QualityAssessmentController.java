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
}
