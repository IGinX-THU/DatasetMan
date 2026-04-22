package com.tsinghua.service;

import cn.edu.tsinghua.iginx.exception.SessionException;
import cn.edu.tsinghua.iginx.session.QueryDataSet;
import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import cn.edu.tsinghua.iginx.session_v2.write.Point;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.dto.DatasetRequest;
import com.tsinghua.entity.DatasetEntity;
import com.tsinghua.util.CommonUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Slf4j
@Service
public class DatasetService {

    private static final String STORAGE_PREFIX = "datasets";
    private static final String META_PREFIX = "relational_system.datasets";

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;


    public Object testSQL(String sql) {
        try {
            CommonUtil.validateSql(sql);
            QueryDataSet queryDataSet = iginxSession.executeQuery(sql);
            return queryDataSet;
        } catch (Exception e) {
            return e.getMessage();
        }
    }

    public void saveDataset(DatasetRequest request) {
        long timestamp = System.currentTimeMillis();
        String version = CommonUtil.generateVersion(timestamp);
        String storagePath = String.format("%s.%s.%s", STORAGE_PREFIX, request.getDatasetName(), version);
        // 构建数据点 - 直接存储二进制数据
        Point point = Point.builder()
                .measurement(storagePath)    // 存储路径
                .key(timestamp)         // 块序号作为时间戳
                .binaryValue(request.getDatasetSql().getBytes(StandardCharsets.UTF_8))          // 直接存储二进制块
                .build();

        WriteClient writeClient = iginxClient.getWriteClient();

        writeClient.writePoint(point);

        // 获取操作人
        String operator = OperationLogAspect.getCurrentUser();

        // 获取IP地址
        String clientIp = OperationLogAspect.getClientIp();

        DatasetEntity datasetEntity = new DatasetEntity();
        datasetEntity.setKey(timestamp);
        datasetEntity.setDatasetName(request.getDatasetName());
        datasetEntity.setDatasetSql(request.getDatasetSql());
        datasetEntity.setParent(request.getParent());
        datasetEntity.setVersion(version);
        datasetEntity.setCreateTime(timestamp);
        datasetEntity.setOperator(operator);
        datasetEntity.setClientIp(clientIp);

        writeClient.writeMeasurement(datasetEntity);

    }

}
