package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

@Slf4j
@Service
public class TransformService {

    private static final String SHOW_TIME_SERIES_SQL = "SHOW COLUMNS;";
    private static final String SHOW_FUNCTION_SQL = "SHOW FUNCTIONS;";
    private static final String CREATE_SQL_FORMATTER = "CREATE FUNCTION TRANSFORM \"%s\" FROM \"%s\" IN \"%s\";";
    private static final String DROP_SQL_FORMATTER = "DROP FUNCTION \"%s\";";

    private static final String FUNCTION_DIR_PREFIX = "function";

    @Autowired
    private Session iginxSession;

    public void register(MultipartFile file, String name, String className) {
        try {
            // 创建函数目录
            Path pathDir = Paths.get(FUNCTION_DIR_PREFIX, "transform");
            if (!Files.exists(pathDir)) {
                Files.createDirectories(pathDir);
                log.info("创建函数目录: {}", pathDir);
            }

            // 保存文件到函数目录
            String fileName = file.getOriginalFilename();
            if (fileName == null || fileName.isEmpty()) {
                fileName = name + ".py";
            }
            Path targetPath = pathDir.resolve(fileName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            log.info("保存Transform文件: {}", targetPath);

            String registerSQL = String.format(CREATE_SQL_FORMATTER, name, className, targetPath.toAbsolutePath());
            log.info("注册Transform SQL: {}", registerSQL);
            iginxSession.executeSql(registerSQL);

        } catch (Exception e) {
            log.error("Transform注册失败", e);
            throw new RuntimeException("Transform注册失败: " + e.getMessage(), e);
        }
    }

}
