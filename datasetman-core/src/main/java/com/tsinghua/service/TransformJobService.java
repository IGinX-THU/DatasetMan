package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.dto.TransformJobRequest;
import com.tsinghua.entity.TransformJobEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class TransformJobService {

    @Autowired
    private IginXClient iginxClient;


    public TransformJobEntity saveTransform(TransformJobRequest runTaskRequest) {
        long timestamp = System.currentTimeMillis();

        // 获取操作人
        String operator = OperationLogAspect.getCurrentUser();

        // 获取IP地址
        String clientIp = OperationLogAspect.getClientIp();

        TransformJobEntity transformJobEntity = new TransformJobEntity();
        transformJobEntity.setId(timestamp);
        transformJobEntity.setName(runTaskRequest.getName());
        transformJobEntity.setTaskList(JSONObject.toJSONString(runTaskRequest.getTaskList()));
        transformJobEntity.setExportFiletName(runTaskRequest.getExportFiletName());
        transformJobEntity.setSchedule(runTaskRequest.getSchedule());
        transformJobEntity.setCreateTime(timestamp);
        transformJobEntity.setOperator(operator);
        transformJobEntity.setClientIp(clientIp);

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(transformJobEntity);

        return transformJobEntity;
    }
}
