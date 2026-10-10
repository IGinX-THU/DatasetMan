package com.tsinghua.service;

import lombok.extern.slf4j.Slf4j;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;

/**
 * 关系型数据源元数据配置文件（meta_properties_path）校验工具。
 *
 * IGinX 加载该文件时，若路径读不到只会打一行 WARN 并静默回退到驱动目录下的默认配置，
 * 导致注册"成功"但方言行为错误，因此在注册前做 best-effort 校验。
 * 前提：DatasetMan 与 IGinX 同机部署（或共享文件系统），文件路径双方可见。
 */
@Slf4j
public final class MetaPropsValidator {

    /**
     * IGinX JDBCMeta 构造时会直接读取的必需 key，缺失会导致 NPE 或方言行为错误
     */
    private static final String[] REQUIRED_KEYS = {
            "driver_class", "quote", "default_database", "system_databases",
            "database_query_sql", "drop_database_statement", "jdbc_need_quote",
            "upsert_statement", "upsert_conflict_statement", "is_support_full_join",
            "regex_like_symbol", "not_regex_like_symbol", "jdbc_support_special_char"
    };

    private MetaPropsValidator() {
    }

    /**
     * 校验指定路径的元数据配置文件（文件存在性 + 必需 key 完整性）
     *
     * @return null 表示校验通过；否则返回可直接展示给用户的错误信息
     */
    public static String validate(String path) {
        Path file = Paths.get(path.trim());
        if (!Files.isRegularFile(file)) {
            return "元数据配置文件不存在或不可读: " + file.toAbsolutePath()
                    + "（路径以IGinX服务器文件系统为准，请确认文件已存在，或使用\"上传配置文件\"由系统代存）";
        }
        Properties props = new Properties();
        try (InputStream in = new FileInputStream(file.toFile())) {
            props.load(in);
        } catch (IOException e) {
            return "元数据配置文件读取失败: " + e.getMessage();
        }
        return validateProperties(props);
    }

    /**
     * 校验已加载的配置内容
     *
     * @return null 表示校验通过；否则返回错误信息
     */
    public static String validateProperties(Properties props) {
        StringBuilder missing = new StringBuilder();
        for (String key : REQUIRED_KEYS) {
            String value = props.getProperty(key);
            if (value == null || value.trim().isEmpty()) {
                missing.append(missing.length() == 0 ? "" : ", ").append(key);
            }
        }
        if (missing.length() > 0) {
            return "配置文件缺少必需配置项: " + missing;
        }
        boolean hasTypeMapping = props.keySet().stream()
                .anyMatch(k -> String.valueOf(k).startsWith("IGinX-"));
        if (!hasTypeMapping) {
            log.warn("元数据配置文件未配置任何 IGinX-* 类型映射，所有列将按字符串(BINARY)类型处理");
        }
        return null;
    }
}
