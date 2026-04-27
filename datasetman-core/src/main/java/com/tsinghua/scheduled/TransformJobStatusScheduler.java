package com.tsinghua.scheduled;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import com.tsinghua.entity.TransformJobEntity;
import com.tsinghua.service.TransformJobService;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * TransformJob状态刷新定时任务
 * 每3分钟刷新未到最终状态的任务状态
 */
@Slf4j
@Component
public class TransformJobStatusScheduler {

    private static final String DATA_PREFIX = "relational_system.transform_job";

    @Autowired
    private Session iginxSession;

    @Autowired
    private TransformJobService transformJobService;

    /**
     * 每3分钟执行一次状态刷新
     * 最终状态包括：JOB_FINISHED(1), JOB_PARTIALLY_FAILED(6), JOB_FAILED(8), JOB_CLOSED(10)
     */
    @Scheduled(fixedRate = 180000) // 3分钟 = 180000毫秒
    public void refreshJobStatus() {
        try {
            log.info("开始刷新TransformJob状态");
            
            // 查询未到最终状态的任务
            List<TransformJobEntity> activeJobs = queryActiveJobs();
            
            if (activeJobs.isEmpty()) {
                return;
            }

            // 逐个刷新任务状态
            for (TransformJobEntity job : activeJobs) {
                try {
                    if (job.getJobId() != null) {
                        transformJobService.statusJob(job.getJobId());
                    }
                } catch (Exception e) {
                    log.error("刷新任务 {} 状态失败: {}", job.getJobId(), e.getMessage());
                }
            }
            
            log.info("TransformJob状态刷新完成");
        } catch (Exception e) {
            log.error("TransformJob状态刷新定时任务执行失败", e);
        }
    }

    /**
     * 查询未到最终状态的任务
     * 最终状态：JOB_FINISHED(1), JOB_PARTIALLY_FAILED(6), JOB_FAILED(8), JOB_CLOSED(10)
     */
    private List<TransformJobEntity> queryActiveJobs() {
        try {
            // 查询所有任务
            String sql = "SELECT * FROM " + DATA_PREFIX + " ;";

            SessionExecuteSqlResult res = iginxSession.executeSql(sql);
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            // 转换为TransformJobEntity列表
            List<TransformJobEntity> allJobs = new ArrayList<>();
            for (Map<String, Object> record : records) {
                TransformJobEntity entity = new TransformJobEntity();
                record.forEach((k, v) -> {
                    String fieldName = k.replace(DATA_PREFIX + ".", "");
                    ConvertUtil.setEntityField(entity, DATA_PREFIX, fieldName, v);
                });
                allJobs.add(entity);
            }

            // 使用stream过滤未到最终状态的任务
            List<TransformJobEntity> result = allJobs.stream()
                    .filter(job -> job.getJobState() != 1
                            && job.getJobState() != 6
                            && job.getJobState() != 8
                            && job.getJobState() != 10)
                    .collect(Collectors.toList());

            log.info("查询到 {} 个活跃任务", result.size());
            return result;
        } catch (Exception e) {
            log.error("查询活跃任务失败", e);
            return new ArrayList<>();
        }
    }
}
