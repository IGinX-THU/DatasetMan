package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import com.tsinghua.entity.FunctionArchiveEntity;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 函数档案服务
 * 参考数据档案服务，集中管理Transform/UDF函数档案的CRUD
 */
@Slf4j
@Service
public class FunctionArchiveService {

    private static final String FUNCTION_ARCHIVE_PREFIX = "relational_system.function_archives";

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    /**
     * 保存函数档案（新增或编辑，编辑时复用原id）
     */
    public void saveArchive(FunctionArchiveEntity archive) throws Exception {
        long timestamp;
        if (archive.getId() != null) {
            timestamp = archive.getId();
        } else if (archive.getCreateTime() != null) {
            timestamp = archive.getCreateTime();
        } else {
            timestamp = System.currentTimeMillis();
        }

        archive.setId(timestamp);
        archive.setCreateTime(timestamp);

        if (!StringUtils.hasText(archive.getOwner())) {
            archive.setOwner(com.tsinghua.auth.util.AuthUtil.getCurrentUsername());
        }

        log.info("准备保存函数档案到IginX: name={}, type={}, udfType={}, desc={}",
                archive.getName(), archive.getType(), archive.getUdfType(), archive.getDesc());

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(archive);

        log.info("函数档案已保存。名称: {}, 类型: {}, 时间戳: {}", archive.getName(), archive.getType(), timestamp);
    }

    /**
     * 根据名称查询函数档案
     */
    public FunctionArchiveEntity findByName(String name) {
        try {
            if (name == null || name.trim().isEmpty()) {
                return null;
            }
            String sql = String.format("SELECT * FROM %s WHERE name = '%s' ORDER BY createTime DESC LIMIT 1;",
                    FUNCTION_ARCHIVE_PREFIX, escape(name.trim()));
            log.info("执行SQL: {}", sql);

            SessionExecuteSqlResult res = iginxSession.executeSql(sql);
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            if (records.isEmpty()) {
                return null;
            }

            FunctionArchiveEntity entity = new FunctionArchiveEntity();
            return ConvertUtil.mapToEntity(entity, records.get(0), FUNCTION_ARCHIVE_PREFIX);
        } catch (Exception e) {
            log.error("根据名称查询函数档案失败", e);
            return null;
        }
    }

    /**
     * 查询全部函数档案
     */
    public List<FunctionArchiveEntity> findAll() {
        return queryArchives(null, null, null, null);
    }

    /**
     * 查询函数档案（支持类别过滤与名称模糊查询，按创建时间倒序）
     */
    public List<FunctionArchiveEntity> queryArchives(String type, String name, Integer pageNum, Integer pageSize) {
        try {
            StringBuilder sql = new StringBuilder("SELECT * FROM " + FUNCTION_ARCHIVE_PREFIX + " WHERE 1=1");

            if (type != null && !type.trim().isEmpty()) {
                sql.append(" AND type = '").append(type.trim()).append("'");
            }
            if (name != null && !name.trim().isEmpty()) {
                sql.append(" AND name LIKE '^.*").append(name.trim()).append(".*'");
            }

            sql.append(" ORDER BY createTime DESC");

            if (pageNum != null && pageSize != null) {
                sql.append(" LIMIT ").append(pageSize);
                sql.append(" OFFSET ").append((pageNum - 1) * pageSize);
            }
            sql.append(";");

            log.info("执行SQL: {}", sql);

            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            return records.stream().map(record -> {
                FunctionArchiveEntity entity = new FunctionArchiveEntity();
                return ConvertUtil.mapToEntity(entity, record, FUNCTION_ARCHIVE_PREFIX);
            }).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("查询函数档案列表失败", e);
            return new ArrayList<>();
        }
    }

    /**
     * 更新函数说明（档案不存在时按type补建）
     */
    public FunctionArchiveEntity updateDesc(String name, String type, String desc) throws Exception {
        FunctionArchiveEntity archive = findByName(name);
        if (archive == null) {
            archive = new FunctionArchiveEntity()
                    .setName(name)
                    .setType(type);
        }
        archive.setDesc(desc);
        saveArchive(archive);
        return archive;
    }

    /**
     * 删除函数档案
     */
    public void deleteArchive(Long timestamp) throws Exception {
        if (timestamp == null) {
            throw new IllegalArgumentException("ID不能为空");
        }
        List<String> measurements = ConvertUtil.iginxFieldNamesConvert(FunctionArchiveEntity.class, FUNCTION_ARCHIVE_PREFIX);
        iginxClient.getDeleteClient().deleteMeasurementsData(measurements, timestamp - 1, timestamp + 1);
        log.info("函数档案已删除。ID: {}", timestamp);
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("'", "''");
    }
}
