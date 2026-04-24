package com.tsinghua.service;

import cn.edu.tsinghua.iginx.exception.SessionException;
import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.thrift.IpPortPair;
import cn.edu.tsinghua.iginx.thrift.RegisterTaskInfo;
import com.tsinghua.dto.RegisterTaskInfoDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class FunctionService {

    private static final String SHOW_TIME_SERIES_SQL = "SHOW COLUMNS;";
    private static final String SHOW_FUNCTION_SQL = "SHOW FUNCTIONS;";
    private static final String CREATE_SQL_FORMATTER = "CREATE FUNCTION TRANSFORM \"%s\" FROM \"%s\" IN \"%s\";";
    private static final String DROP_SQL_FORMATTER = "DROP FUNCTION \"%s\";";

    private static final String FUNCTION_DIR_PREFIX = "function";

    @Autowired
    private Session iginxSession;

    public void registerTransform(MultipartFile file, String name, String className) throws Exception {
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
    }

    public void delete(String name) throws SessionException {
        String registerSQL = String.format(DROP_SQL_FORMATTER, name);
        log.info("删除Transform SQL: {}", registerSQL);
        iginxSession.executeSql(registerSQL);
    }

    public List<RegisterTaskInfoDto> query(String type) throws SessionException {
        SessionExecuteSqlResult result = iginxSession.executeSql(SHOW_FUNCTION_SQL);
        List<RegisterTaskInfo> registerTaskInfos = result.getRegisterTaskInfos();
        List<RegisterTaskInfoDto> registerTaskInfoDtos = new ArrayList<>();
        for (RegisterTaskInfo info : registerTaskInfos) {
            StringJoiner joiner = new StringJoiner(", ");
            for (IpPortPair p : info.getIpPortPair()) {
                joiner.add(String.format("%s:%d", p.getIp(), p.getPort()));
            }
            registerTaskInfoDtos.add(
                    new RegisterTaskInfoDto(
                            info.getName(),
                            info.getClassName(),
                            info.getFileName(),
                            joiner.toString(),
                            info.getType().toString()));
        }
        if ("transform".equalsIgnoreCase(type)){
            return registerTaskInfoDtos.stream().filter(info -> info.getType().equals("TRANSFORM")).collect(Collectors.toList());
        } else if ("udf".equalsIgnoreCase(type)){
            return registerTaskInfoDtos.stream().filter(info -> !info.getType().equals("TRANSFORM")).collect(Collectors.toList());
        } else {
            return registerTaskInfoDtos;
        }
    }
}
