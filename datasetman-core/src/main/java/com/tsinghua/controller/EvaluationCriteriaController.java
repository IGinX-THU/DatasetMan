package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.dto.EvaluationCriteriaQueryRequest;
import com.tsinghua.dto.EvaluationCriteriaRequest;
import com.tsinghua.entity.EvaluationCriteriaEntity;
import com.tsinghua.model.Result;
import com.tsinghua.service.EvaluationCriteriaService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "评价准则")
@RestController
@RequestMapping("/api/evaluation-criteria")
public class EvaluationCriteriaController {

    @Autowired
    private EvaluationCriteriaService evaluationCriteriaService;

    @ApiOperation("保存评价准则")
    @PostMapping("/save")
    @RequirePermission(Permission.CREATE)
    @OperationLog(value = "保存评价准则", type = OperationLog.OperationType.CREATE)
    public Result<EvaluationCriteriaEntity> saveCriteria(@RequestBody EvaluationCriteriaRequest request) throws Exception {
        return Result.success(evaluationCriteriaService.saveCriteria(request));
    }

    @ApiOperation("分页查询评价准则")
    @PostMapping("/query")
    @RequirePermission(Permission.READ)
    public Result<List<EvaluationCriteriaEntity>> queryCriteria(@RequestBody EvaluationCriteriaQueryRequest request) {
        return Result.success(evaluationCriteriaService.queryCriteria(request));
    }

    @ApiOperation("查询评价准则总数")
    @PostMapping("/count")
    @RequirePermission(Permission.READ)
    public Result<Object> countCriteria(@RequestBody EvaluationCriteriaQueryRequest request) {
        return Result.success(evaluationCriteriaService.countCriteria(request));
    }

    @ApiOperation("查询评价准则详情")
    @GetMapping("/detail")
    @RequirePermission(Permission.READ)
    public Result<EvaluationCriteriaEntity> queryById(@RequestParam("id") Long id) {
        EvaluationCriteriaEntity result = evaluationCriteriaService.queryById(id);
        if (result == null) {
            return Result.error("未找到指定的评价准则");
        }
        return Result.success(result);
    }

    @ApiOperation("删除评价准则")
    @DeleteMapping("/delete")
    @RequirePermission(Permission.DELETE)
    @OperationLog(value = "删除评价准则", type = OperationLog.OperationType.DELETE)
    public Result<Void> deleteCriteria(@RequestParam("id") Long id) {
        evaluationCriteriaService.deleteCriteria(id);
        return Result.success("操作成功");
    }
}
