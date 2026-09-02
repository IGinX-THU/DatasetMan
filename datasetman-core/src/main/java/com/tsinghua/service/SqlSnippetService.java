package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.SqlSnippetRequest;
import com.tsinghua.entity.SqlSnippetEntity;
import com.tsinghua.util.CommonUtil;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * SQL片段管理服务
 * 独立管理的可复用SQL列表资源，供transform编排和数据集版本生产引用。
 */
@Slf4j
@Service
public class SqlSnippetService {

    private static final String META_PREFIX = "relational_system.sql_snippet";

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    /**
     * 保存SQL片段（新建或编辑）
     */
    public SqlSnippetEntity saveSnippet(SqlSnippetRequest request) {
        request.getSqlList().forEach(CommonUtil::validateSql);

        long timestamp;
        if (request.getId() != null) {
            // 编辑：复用原id
            timestamp = request.getId();
        } else {
            timestamp = System.currentTimeMillis();
        }

        String operator = OperationLogAspect.getCurrentUser();
        String clientIp = OperationLogAspect.getClientIp();
        String owner = AuthUtil.getCurrentUsername();

        SqlSnippetEntity entity = new SqlSnippetEntity();
        entity.setId(timestamp);
        entity.setName(request.getName());
        entity.setSqlList(JSONObject.toJSONString(request.getSqlList()));
        entity.setDescription(request.getDescription());
        entity.setOwner(owner);
        entity.setCreateTime(timestamp);
        entity.setOperator(operator);
        entity.setClientIp(clientIp);
        entity.setDeleted(false);

        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(entity);

        log.info("SQL片段已保存。名称: {}, id: {}", request.getName(), timestamp);
        return entity;
    }

    /**
     * 按id查询SQL片段
     */
    public SqlSnippetEntity queryById(Long id) {
        try {
            String sql = "select * from %s where id = %s";
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                if (!"unknown".equals(currentUser)) {
                    sql += " AND owner = '" + currentUser + "'";
                }
            }
            sql += ";";
            String formatSQL = String.format(sql, META_PREFIX, id);
            log.info(formatSQL);
            SessionExecuteSqlResult res = iginxSession.executeSql(formatSQL);
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            if (records.isEmpty()) {
                return null;
            }
            return mapToEntity(records.get(0));
        } catch (Exception e) {
            log.error("查询SQL片段失败, id={}", id, e);
            return null;
        }
    }

    /**
     * 按名称查询SQL片段（用于transform编排按名引用）
     */
    public SqlSnippetEntity queryByName(String name) {
        try {
            String sql = "select * from %s where name = '%s' AND deleted = false";
            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                if (!"unknown".equals(currentUser)) {
                    sql += " AND owner = '" + currentUser + "'";
                }
            }
            sql += " ORDER BY createTime DESC LIMIT 1;";
            String formatSQL = String.format(sql, META_PREFIX, name);
            log.info(formatSQL);
            SessionExecuteSqlResult res = iginxSession.executeSql(formatSQL);
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            if (records.isEmpty()) {
                return null;
            }
            return mapToEntity(records.get(0));
        } catch (Exception e) {
            log.error("按名称查询SQL片段失败, name={}", name, e);
            return null;
        }
    }

    /**
     * 查询SQL片段列表（支持名称模糊查询）
     */
    public List<SqlSnippetEntity> listSnippets(String name) {
        try {
            StringBuilder sql = new StringBuilder("SELECT * FROM ")
                    .append(META_PREFIX)
                    .append(" WHERE deleted = false");

            if (!AuthUtil.isAdmin()) {
                String currentUser = AuthUtil.getCurrentUsername();
                if (!"unknown".equals(currentUser)) {
                    sql.append(" AND owner = '").append(currentUser).append("'");
                }
            }

            if (StringUtils.hasText(name)) {
                sql.append(" AND name LIKE '%").append(name.trim()).append("%'");
            }

            sql.append(" ORDER BY createTime DESC;");

            log.info(sql.toString());
            SessionExecuteSqlResult res = iginxSession.executeSql(sql.toString());
            List<Map<String, Object>> records = ConvertUtil.getRecords(res);

            List<SqlSnippetEntity> result = records.stream()
                    .map(this::mapToEntity)
                    .sorted(Comparator.comparing(SqlSnippetEntity::getCreateTime).reversed())
                    .collect(Collectors.toList());

            return result;
        } catch (Exception e) {
            log.error("查询SQL片段列表失败", e);
            return new ArrayList<>();
        }
    }

    /**
     * 软删除SQL片段
     */
    public void deleteSnippet(Long id) {
        SqlSnippetEntity entity = queryById(id);
        if (entity == null) {
            throw new RuntimeException("SQL片段不存在或无权删除");
        }
        entity.setDeleted(true);
        entity.setId(entity.getCreateTime());
        WriteClient writeClient = iginxClient.getWriteClient();
        writeClient.writeMeasurement(entity);
        log.info("已软删除SQL片段: id={}, name={}", id, entity.getName());
    }

    /**
     * 根据id获取SQL列表（供transform编排使用）
     */
    public List<String> getSqlListById(Long id) {
        SqlSnippetEntity entity = queryById(id);
        if (entity == null) {
            throw new RuntimeException("SQL片段不存在: id=" + id);
        }
        return JSONArray.parseArray(entity.getSqlList(), String.class);
    }

    /**
     * 根据名称获取SQL列表（供transform编排使用）
     */
    public List<String> getSqlListByName(String name) {
        SqlSnippetEntity entity = queryByName(name);
        if (entity == null) {
            throw new RuntimeException("SQL片段不存在: name=" + name);
        }
        return JSONArray.parseArray(entity.getSqlList(), String.class);
    }

    private SqlSnippetEntity mapToEntity(Map<String, Object> record) {
        SqlSnippetEntity entity = new SqlSnippetEntity();
        record.forEach((k, v) -> {
            String fieldName = k.replace(META_PREFIX + ".", "");
            ConvertUtil.setEntityField(entity, META_PREFIX, fieldName, v);
        });
        return entity;
    }
}
