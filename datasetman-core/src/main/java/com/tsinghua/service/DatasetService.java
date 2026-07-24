package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.QueryDataSet;
import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.DeleteClient;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import cn.edu.tsinghua.iginx.session_v2.write.Point;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.service.DataPermissionService;
import com.tsinghua.auth.util.AuthUtil;
import org.springframework.util.CollectionUtils;
import com.tsinghua.dto.DatasetRequest;
import com.tsinghua.entity.DatasetEntity;
import com.tsinghua.enums.SchemaPrefix;
import com.tsinghua.util.CommonUtil;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class DatasetService {

    private static final String STORAGE_PREFIX = SchemaPrefix.DATASET_PREFIX;
    private static final String META_PREFIX = "relational_system.dataset_meta";

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    @Autowired
    private DataPermissionService dataPermissionService;


    public Object testSQL(String sql) {
        try {
            CommonUtil.validateSql(sql);
            QueryDataSet queryDataSet = iginxSession.executeQuery(sql);
            return queryDataSet;
        } catch (Exception e) {
            return e.getMessage();
        }
    }

    public DatasetEntity saveDataset(DatasetRequest request) {
        request.getDatasetSql().forEach(CommonUtil::validateSql);
        long timestamp = System.currentTimeMillis();
        String version = CommonUtil.generateVersion(timestamp);
        String storagePath = String.format("%s.%s.%s", STORAGE_PREFIX, request.getDatasetName(), version);
        // 构建数据点 - 直接存储二进制数据
        Point point = Point.builder()
                .measurement(storagePath)    // 存储路径
                .key(timestamp)         // 块序号作为时间戳
                .binaryValue(JSONObject.toJSONString(request.getDatasetSql()).getBytes(StandardCharsets.UTF_8))          // 直接存储二进制块
                .build();

        WriteClient writeClient = iginxClient.getWriteClient();

        writeClient.writePoint(point);

        // 获取操作人
        String operator = OperationLogAspect.getCurrentUser();

        // 获取IP地址
        String clientIp = OperationLogAspect.getClientIp();

        DatasetEntity datasetEntity = new DatasetEntity();
        datasetEntity.setId(timestamp);
        datasetEntity.setDatasetName(request.getDatasetName());
        datasetEntity.setDatasetSql(JSONObject.toJSONString(request.getDatasetSql()));
        datasetEntity.setParent(request.getParent());
        datasetEntity.setRemark(request.getRemark());
        datasetEntity.setVersion(version);
        datasetEntity.setStoragePath(storagePath);
        datasetEntity.setCreateTime(timestamp);
        datasetEntity.setOperator(operator);
        datasetEntity.setClientIp(clientIp);

        writeClient.writeMeasurement(datasetEntity);

        dataPermissionService.saveTablePrefix(storagePath);
        log.info("模型文件上传成功。storagePath: {}", storagePath);

        return datasetEntity;
    }

    public DatasetEntity queryMeta(String path) {
        if (!AuthUtil.isAdmin()) {
            List<String> accessibleTables = dataPermissionService.getCurrentUserAccessibleTables();
            if (CollectionUtils.isEmpty(accessibleTables) || !accessibleTables.contains(path)) {
                log.warn("用户{}无权访问数据集: {}", AuthUtil.getCurrentUsername(), path);
                return null;
            }
        }
        try {
            String sql = "select * from %s where storagePath = '%s';";
            String formatSQL = String.format(sql, META_PREFIX, path);
            log.info(formatSQL);
            SessionExecuteSqlResult res = iginxSession.executeSql(formatSQL);
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            if (records.isEmpty()) {
                return null;
            }

            DatasetEntity entity = new DatasetEntity();
            Map<String, Object> rs = records.get(0);
            // 使用ConvertUtil的通用方法设置字段值
            rs.forEach((k, v) -> {
                String fieldName = k.replace(META_PREFIX + ".", "");
                ConvertUtil.setEntityField(entity, META_PREFIX, fieldName, v);
            });
            return entity;
        } catch (Exception e) {
            log.error("查询解析规则失败", e);
            return null;
        }
    }

    public void deleteDataset(String path) {
        DatasetEntity datasetEntity = queryMeta(path);
        if (datasetEntity != null) {
            datasetEntity.setDeleted(true);
            datasetEntity.setId(datasetEntity.getCreateTime());
            WriteClient writeClient = iginxClient.getWriteClient();
            writeClient.writeMeasurement(datasetEntity);
        }
        DeleteClient deleteClient = iginxClient.getDeleteClient();
        deleteClient.deleteMeasurement(path);
    }

    /**
     * 查询数据集的版本历史
     * @param datasetName 数据集名称
     * @return 版本历史树形结构
     */
    public List<com.tsinghua.dto.DatasetVersionTreeDTO> getVersionHistory(String datasetName) {
        try {
            String sql = "select * from %s where datasetName = '%s' order by createTime desc;";
            String formatSQL = String.format(sql, META_PREFIX, datasetName);
            log.info(formatSQL);
            SessionExecuteSqlResult res = iginxSession.executeSql(formatSQL);
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            if (records.isEmpty()) {
                return new ArrayList<>();
            }

            // 非管理员用户根据数据集路径权限过滤
            List<String> accessibleTables = AuthUtil.isAdmin() ? null : dataPermissionService.getCurrentUserAccessibleTables();

            List<DatasetEntity> versionList = new ArrayList<>();
            for (Map<String, Object> rs : records) {
                DatasetEntity entity = new DatasetEntity();
                rs.forEach((k, v) -> {
                    String fieldName = k.replace(META_PREFIX + ".", "");
                    ConvertUtil.setEntityField(entity, META_PREFIX, fieldName, v);
                });
                if (accessibleTables != null && !accessibleTables.contains(entity.getStoragePath())) {
                    continue;
                }
                versionList.add(entity);
            }

            // 按创建时间倒序排列（最新的在前）
            versionList.sort(Comparator.comparing(DatasetEntity::getCreateTime).reversed());

            // 构建树形结构
            return buildVersionTree(versionList);
        } catch (Exception e) {
            log.error("查询版本历史失败", e);
            return new ArrayList<>();
        }
    }

    /**
     * 构建版本树形结构
     * @param versionList 版本列表
     * @return 树形结构
     */
    private List<com.tsinghua.dto.DatasetVersionTreeDTO> buildVersionTree(List<DatasetEntity> versionList) {
        // 创建节点映射
        Map<Long, com.tsinghua.dto.DatasetVersionTreeDTO> nodeMap = new HashMap<>();
        for (DatasetEntity version : versionList) {
            com.tsinghua.dto.DatasetVersionTreeDTO node = new com.tsinghua.dto.DatasetVersionTreeDTO();
            node.setId(version.getVersion());
            node.setName(version.getVersion());
            node.setTime(formatTimestamp(version.getCreateTime()));
            node.setTimestamp(version.getCreateTime());
            node.setParent(version.getParent());
            node.setColor(version.isDeleted() ? "#d9d9d9" : "#1890ff");
            node.setUser(version.getOperator() != null ? version.getOperator() : "unknown");
            node.setIp(version.getClientIp() != null ? version.getClientIp() : "unknown");
            node.setSql(version.getDatasetSql() != null ? version.getDatasetSql() : "");
            node.setRemark(version.getRemark() != null ? version.getRemark() : "");
            node.setDeleted(version.isDeleted());
            node.setChildren(new ArrayList<>());
            nodeMap.put(version.getCreateTime(), node);
        }

        // 构建树形结构
        List<com.tsinghua.dto.DatasetVersionTreeDTO> treeData = new ArrayList<>();
        Set<Long> processed = new HashSet<>();

        for (DatasetEntity version : versionList) {
            if (processed.contains(version.getCreateTime())) {
                continue;
            }

            // 找到根节点（parent为0的节点）
            if (version.getParent() == 0) {
                com.tsinghua.dto.DatasetVersionTreeDTO node = nodeMap.get(version.getCreateTime());
                buildTreeRecursive(node, nodeMap, processed);
                treeData.add(node);
            }
        }

        // 如果没有找到根节点，取最新的作为根节点
        if (treeData.isEmpty() && !versionList.isEmpty()) {
            DatasetEntity latest = versionList.get(0);
            com.tsinghua.dto.DatasetVersionTreeDTO node = nodeMap.get(latest.getCreateTime());
            buildTreeRecursive(node, nodeMap, processed);
            treeData.add(node);
        }

        return treeData;
    }

    /**
     * 递归构建树
     * @param node 当前节点
     * @param nodeMap 节点映射
     * @param processed 已处理节点
     */
    private void buildTreeRecursive(com.tsinghua.dto.DatasetVersionTreeDTO node, Map<Long, com.tsinghua.dto.DatasetVersionTreeDTO> nodeMap, Set<Long> processed) {
        processed.add(node.getTimestamp());

        // 查找所有parent等于当前节点createTime的节点
        for (com.tsinghua.dto.DatasetVersionTreeDTO childNode : nodeMap.values()) {
            if (!processed.contains(childNode.getTimestamp()) && childNode.getParent() != null && childNode.getParent().equals(node.getTimestamp())) {
                node.getChildren().add(childNode);
                buildTreeRecursive(childNode, nodeMap, processed);
            }
        }
    }

    /**
     * 格式化时间戳
     * @param timestamp 时间戳
     * @return 格式化后的时间字符串
     */
    private String formatTimestamp(Long timestamp) {
        if (timestamp == null) {
            return "-";
        }
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
        return sdf.format(new java.util.Date(timestamp));
    }

}
