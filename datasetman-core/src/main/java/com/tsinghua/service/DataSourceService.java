package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.ClusterInfo;
import cn.edu.tsinghua.iginx.session.Column;
import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.thrift.RemovedStorageEngineInfo;
import cn.edu.tsinghua.iginx.thrift.StorageEngineInfo;
import cn.edu.tsinghua.iginx.thrift.StorageEngineType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsinghua.auth.service.DataPermissionService;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.ColumnDto;
import com.tsinghua.dto.DataSourceRequest;
import com.tsinghua.dto.DatasetVersionRegisterRequest;
import com.tsinghua.dto.StorageEngineInfoDto;
import com.tsinghua.dto.request.BaseStorageEngineRequest;
import com.tsinghua.entity.DatasetInfoEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;


/**
 * 数据源管理服务
 */
@Slf4j
@Service
public class DataSourceService {

    @Autowired
    private Session iginxSession;

    @Autowired
    private DataPermissionService dataPermissionService;

    @Autowired
    private DatasetVersionService datasetVersionService;

    /**
     * 注册异构数据源
     */
    public boolean registerDataSource(BaseStorageEngineRequest request) throws Exception {

        String tablePrefix = StringUtils.hasText(request.getDataPrefix()) ?
                request.getSchemaPrefix() + "." + request.getDataPrefix() :
                request.getSchemaPrefix();

        if (dataPermissionService.existTablePrefix(tablePrefix)) {
            throw new IllegalArgumentException("数据资源已存在");
        }
        // iginxSession.openSession();
        iginxSession.addStorageEngine(request.getIp(),
                request.getPort(),
                StorageEngineType.findByValue(request.getStorageEngineType()),
                request.buildExtraParams());
        // iginxSession.closeSession();
        dataPermissionService.saveTablePrefix(tablePrefix);
        log.info("成功注册数据源: {}", request);

        // 系统作业目录不是业务数据集；其余数据源注册后自动作为 SOURCE 类型数据集与版本挂载
        if (!"file_system.sys_data".equals(tablePrefix)) {
            String logicalDatasetName = StringUtils.hasText(request.getDatasetName()) ? request.getDatasetName().trim() : tablePrefix;
            String modality = StringUtils.hasText(request.getDataModality()) ? request.getDataModality().trim() : "relational";

            DatasetVersionRegisterRequest versionRequest = new DatasetVersionRegisterRequest();
            versionRequest.setDatasetName(logicalDatasetName);
            versionRequest.setProvenanceType("SOURCE");
            versionRequest.setStoragePath(tablePrefix);
            versionRequest.setDescription(request.getDescription());
            versionRequest.setDataModality(modality);
            Map<String, Object> config = new HashMap<>();
            config.put("tablePrefix", tablePrefix);
            config.put("storageEngineType", request.getStorageEngineType());
            config.put("ip", request.getIp());
            config.put("port", request.getPort());
            config.put("schemaPrefix", request.getSchemaPrefix());
            config.put("dataPrefix", request.getDataPrefix());
            config.put("engineConfig", request.buildExtraParams());
            versionRequest.setDerivationConfig(config);
            datasetVersionService.registerVersion(versionRequest);
        }

        return true;
    }

    /**
     * 移除异构数据源
     */
    public boolean removeDataSource(StorageEngineInfoDto storageEngineInfoDto) throws Exception {

        String tablePrefix = StringUtils.hasText(storageEngineInfoDto.getDataPrefix()) ?
                storageEngineInfoDto.getSchemaPrefix() + "." + storageEngineInfoDto.getDataPrefix() :
                storageEngineInfoDto.getSchemaPrefix();

        DatasetVersionEntity sourceVersion = datasetVersionService.queryVersionByStoragePath(tablePrefix);
        if (sourceVersion != null && "SOURCE".equals(sourceVersion.getProvenanceType())) {
            // 通过 datasetVersionService.softDeleteVersion 统一完成依赖检查、卸载存储引擎、清理权限与元数据
            datasetVersionService.softDeleteVersion(sourceVersion.getId());
        } else {
            // 若无版本关联记录，执行底层存储引擎注销
            RemovedStorageEngineInfo removedStorageEngineInfo = new RemovedStorageEngineInfo(storageEngineInfoDto.getIp(), storageEngineInfoDto.getPort(), storageEngineInfoDto.getSchemaPrefix(), storageEngineInfoDto.getDataPrefix());
            List<RemovedStorageEngineInfo> removedStorageEngineList = Collections.singletonList(removedStorageEngineInfo);
            iginxSession.removeStorageEngine(removedStorageEngineList);
            dataPermissionService.deleteByTablePrefix(tablePrefix);
        }

        return true;
    }

    public List<StorageEngineInfoDto> dataSourceList() throws Exception {
        // iginxSession.openSession();
        ClusterInfo clusterInfo = iginxSession.getClusterInfo();
        List<StorageEngineInfo> storageEngineInfos = clusterInfo.getStorageEngineInfos();
        List<StorageEngineInfoDto> storageEngineInfoDtos = storageEngineInfos.stream().map(s -> new StorageEngineInfoDto(s.id, s.ip, s.port, s.type.getValue(), s.schemaPrefix, s.dataPrefix)).collect(Collectors.toList());
        // iginxSession.closeSession();
        if (!AuthUtil.isAdmin()) {
            List<StorageEngineInfoDto> filteredList = new ArrayList<>();
            List<String> accessibleTables = dataPermissionService.getCurrentUserAccessibleTables();
            if (CollectionUtils.isEmpty(accessibleTables)) {
                return filteredList;
            }
            accessibleTables.forEach(accessibleTable -> filteredList.addAll(
                    storageEngineInfoDtos.stream().filter(storageEngineInfoDto -> {
                                String tablePrefix = StringUtils.hasText(storageEngineInfoDto.getDataPrefix()) ?
                                        storageEngineInfoDto.getSchemaPrefix() + "." + storageEngineInfoDto.getDataPrefix() :
                                        storageEngineInfoDto.getSchemaPrefix();
                                return accessibleTable.equalsIgnoreCase(tablePrefix) && !"file_system.sys_data".equals(tablePrefix);
                    })
                            .collect(Collectors.toList())));
            return filteredList;
        }
        return storageEngineInfoDtos;
    }

    public List<ColumnDto> dataSourceTree() throws Exception {
        // 从 DatasetInfo 获取模态信息 (优先 dataModality，回退 description)
        List<DatasetInfoEntity> datasets = datasetVersionService.listDatasets();
        Map<String, String> datasetModalityMap = new HashMap<>();
        if (!CollectionUtils.isEmpty(datasets)) {
            datasets.forEach(d -> {
                String modality = StringUtils.hasText(d.getDataModality()) ? d.getDataModality() : d.getDescription();
                if (StringUtils.hasText(d.getName()) && StringUtils.hasText(modality)) {
                    datasetModalityMap.putIfAbsent(d.getName(), modality);
                }
            });
        }

        List<ColumnDto> tree = iginxSession.showColumns().stream()
                .filter(column -> !column.getPath().contains("relational_system"))
                .map(column -> {
                    ColumnDto dto = new ColumnDto();
                    dto.setPath(column.getPath());
                    dto.setDataType(column.getDataType().getValue());
                    if (!datasetModalityMap.isEmpty()) {
                        String modality = datasetModalityMap.entrySet().stream()
                                .filter(entry -> column.getPath().startsWith(entry.getKey()))
                                .map(Map.Entry::getValue)
                                .findFirst()
                                .orElse(null);
                        dto.setDataModality(modality);
                    }
                    return dto;
                })
                .collect(Collectors.toList());

        if (!AuthUtil.isAdmin()) {
            List<String> accessibleTables = dataPermissionService.getCurrentUserAccessibleTables();
            if (CollectionUtils.isEmpty(accessibleTables)) {
                return Collections.emptyList();
            }
            Set<String> accessibleSet = new HashSet<>(accessibleTables);
            return tree.stream()
                    .filter(columnDto -> accessibleSet.stream()
                            .anyMatch(prefix -> columnDto.getPath().startsWith(prefix)) || columnDto.getPath().startsWith("transform."))
                    .collect(Collectors.toList());
        }
        return tree;
    }

}