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
        if (!upperSql.startsWith("SELECT") && !upperSql.startsWith("SHOW")) {
            throw new IllegalArgumentException("仅支持查询类型的 SQL 语句");
        }

        // 2. 禁止用户传入IGinX危险语法（使用精确匹配，避免误判字段名如 clear_time）
        String[] forbiddenIGinXKeywords = {"CLEAR", "LOAD", "GRANT", "REMOVE", "SET", "ADD", "COMMIT"};
        for (String keyword : forbiddenIGinXKeywords) {
            if (containsKeywordAsWholeWord(upperSql, keyword)) {
                throw new IllegalArgumentException("SQL 语句中禁止包含IGinX危险关键字：" + keyword);
            }
        }

        // 3. 禁止危险关键字（防注入，避免误判 createtime/updatetime 等字段名）
        String[] dangerousKeywords = {"DELETE", "UPDATE", "INSERT", "DROP", "ALTER", "TRUNCATE", "UNION", "CREATE"};
        for (String keyword : dangerousKeywords) {
            if (containsKeywordAsWholeWord(upperSql, keyword)) {
                throw new IllegalArgumentException("SQL 语句中禁止包含危险操作关键字：" + keyword);
            }
        }
    }

    /**
     * 检查SQL中是否包含独立的关键字（避免字段名中包含关键字导致误判）
     * 匹配规则：关键字必须作为完整的词出现，前后必须是以下分隔符之一：
     * - 字符串开头/结尾
     * - 空格、括号、分号、逗号、换行符等SQL分隔符
     *
     * @param sql 待检测的SQL语句（已转为大写）
     * @param keyword 关键字（大写）
     * @return 是否包含该关键字作为独立词汇
     */
    private static boolean containsKeywordAsWholeWord(String sql, String keyword) {
        int index = 0;
        int keywordLength = keyword.length();

        while ((index = sql.indexOf(keyword, index)) != -1) {
            boolean isStartBoundary = isWordBoundary(sql, index - 1);
            boolean isEndBoundary = isWordBoundary(sql, index + keywordLength);

            if (isStartBoundary && isEndBoundary) {
                return true;
            }
            index += keywordLength;
        }
        return false;
    }

    /**
     * 判断字符位置是否是单词边界
     * 边界条件：字符串越界、空格、括号、分号、逗号、换行符、制表符等SQL分隔符
     *
     * @param sql SQL字符串
     * @param pos 检查位置
     * @return 是否为边界
     */
    private static boolean isWordBoundary(String sql, int pos) {
        if (pos < 0 || pos >= sql.length()) {
            return true;
        }
        char c = sql.charAt(pos);
        return Character.isWhitespace(c) || c == '(' || c == ')' || c == ';' ||
               c == ',' || c == '\n' || c == '\r' || c == '\t' || c == '.';
    }


}