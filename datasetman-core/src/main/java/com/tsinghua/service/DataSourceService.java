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
import com.tsinghua.dto.StorageEngineInfoDto;
import com.tsinghua.dto.request.BaseStorageEngineRequest;
import com.tsinghua.entity.DataArchiveEntity;
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
    private DataArchiveService dataArchiveService;

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

        // 保存数据档案
        saveDataSourceArchive(request, tablePrefix);

        return true;
    }

    /**
     * 移除异构数据源
     */
    public boolean removeDataSource(StorageEngineInfoDto storageEngineInfoDto) throws Exception {

        // 删除对应的数据档案元数据
        String tablePrefix = StringUtils.hasText(storageEngineInfoDto.getDataPrefix()) ?
                storageEngineInfoDto.getSchemaPrefix() + "." + storageEngineInfoDto.getDataPrefix() :
                storageEngineInfoDto.getSchemaPrefix();
        try {
            DataArchiveEntity archive = dataArchiveService.findByName(tablePrefix);
            if (archive != null && archive.getCreateTime() != null) {
                dataArchiveService.deleteArchive(archive.getCreateTime());
                log.info("已删除数据源档案元数据: {}", tablePrefix);
            }
        } catch (Exception e) {
            log.error("删除数据源档案元数据失败", e);
        }

        // iginxSession.openSession();
        RemovedStorageEngineInfo removedStorageEngineInfo = new RemovedStorageEngineInfo(storageEngineInfoDto.getIp(), storageEngineInfoDto.getPort(), storageEngineInfoDto.getSchemaPrefix(), storageEngineInfoDto.getDataPrefix());
        List<RemovedStorageEngineInfo> removedStorageEngineList = Collections.singletonList(removedStorageEngineInfo);
        iginxSession.removeStorageEngine(removedStorageEngineList);
        // iginxSession.closeSession();

        dataPermissionService.deleteByTablePrefix(tablePrefix);

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
                                return accessibleTable.equalsIgnoreCase(tablePrefix);
                    })
                            .collect(Collectors.toList())));
            return filteredList;
        }
        return storageEngineInfoDtos;
    }

    public List<ColumnDto> dataSourceTree() throws Exception {
        List<DataArchiveEntity> archives = dataArchiveService.findAll();
        Map<String, String> archiveMap = new HashMap<>();
        if (!CollectionUtils.isEmpty(archives)) {
            archives.forEach(archive -> {
                if (StringUtils.hasText(archive.getName()) && StringUtils.hasText(archive.getDesc())) {
                    archiveMap.putIfAbsent(archive.getName(), archive.getDesc());
                }
            });
        }

        List<ColumnDto> tree = iginxSession.showColumns().stream()
                .filter(column -> !column.getPath().contains("relational_system"))
                .map(column -> {
                    ColumnDto dto = new ColumnDto();
                    dto.setPath(column.getPath());
                    dto.setDataType(column.getDataType().getValue());
                    if (!archiveMap.isEmpty()) {
                        String modality = archiveMap.entrySet().stream()
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

    /**
     * 保存数据源档案
     */
    private void saveDataSourceArchive(BaseStorageEngineRequest request, String tablePrefix) {
        try {
            DataArchiveEntity archive = new DataArchiveEntity();
            archive.setName(tablePrefix);
            archive.setType("datasource");
            archive.setDesc(request.getDescription());
            
            log.info("准备保存数据源档案: name={}, desc={}", archive.getName(), archive.getDesc());
            
            // 从上下文获取项目名称和用户名
            archive.setOwner(AuthUtil.getCurrentUsername());

            // 将请求对象转换为JSON字符串保存到config字段
            ObjectMapper objectMapper = new ObjectMapper();
            String configJson = objectMapper.writeValueAsString(request);
            archive.setConfig(configJson);

            dataArchiveService.saveArchive(archive);
            log.info("数据源档案已保存: {}, desc={}", tablePrefix, archive.getDesc());
        } catch (Exception e) {
            log.error("保存数据源档案失败", e);
            // 不抛出异常，避免影响主流程
        }
    }

}