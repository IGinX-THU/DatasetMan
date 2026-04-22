package com.tsinghua.util;

import org.springframework.util.Assert;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public class CommonUtil {

    public static String generateVersion(long timestamp) {
        DateTimeFormatter FORMATTER =
                DateTimeFormatter.ofPattern("'v_'yyMMdd_HHmmss")
                        .withZone(ZoneId.of("Asia/Shanghai"));
        return FORMATTER.format(Instant.ofEpochMilli(timestamp));
    }

    /**
     * SQL 合法性校验（调整：允许分页语法？不，分页由我们手动拼接，依然禁止用户传入）
     */
    public static void validateSql(String sql) {
        Assert.notNull(sql, "SQL 语句不能为空");
        String upperSql = sql.trim().toUpperCase();

        // 1. 仅允许 SELECT 语句
        if (!upperSql.startsWith("SELECT")) {
            throw new IllegalArgumentException("仅支持 SELECT 类型的 SQL 语句");
        }

        // 2. 禁止用户传入IGinX危险语法
        String[] forbiddenIGinXKeywords = {"CLEAR", "LOAD", "GRANT", "REMOVE"};
        for (String keyword : forbiddenIGinXKeywords) {
            if (upperSql.contains(keyword)) {
                throw new IllegalArgumentException("SQL 语句中禁止包含IGinX危险关键字：" + keyword);
            }
        }

        // 3. 禁止危险关键字（防注入）
        String[] dangerousKeywords = {"DELETE", "UPDATE", "INSERT", "DROP", "ALTER", "TRUNCATE", "UNION"};
        for (String keyword : dangerousKeywords) {
            if (upperSql.contains(keyword)) {
                throw new IllegalArgumentException("SQL 语句中禁止包含危险操作关键字：" + keyword);
            }
        }
    }




}
