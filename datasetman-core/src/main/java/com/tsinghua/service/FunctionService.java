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

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;

@Slf4j
@Service
public class FunctionService {

    private static final String SHOW_FUNCTION_SQL = "SHOW FUNCTIONS;";
    private static final String CREATE_TRANSFORM_FORMATTER = "CREATE FUNCTION TRANSFORM \"%s\" FROM \"%s\" IN \"%s\";";
    private static final String DROP_SQL_FORMATTER = "DROP FUNCTION \"%s\";";
    private static final String CREATE_UDF_FORMATTER = "CREATE FUNCTION %s \"%s\" FROM \"%s\" IN \"%s\";";
    private static final String SYS_DIR_PREFIX = "sys_data";
    private static final String FUNCTION_DIR_PREFIX = "function";
    private static final String TRANSFORM = "transform";
    private static final String UDF = "udf";

    @Autowired
    private Session iginxSession;

    public void registerTransform(MultipartFile file, String name, String className) throws Exception {
        // 创建函数目录
        Path pathDir = Paths.get(SYS_DIR_PREFIX, FUNCTION_DIR_PREFIX, TRANSFORM);
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

        String filePath = targetPath.toAbsolutePath().toString();
        String registerSQL = String.format(CREATE_TRANSFORM_FORMATTER, name, className, filePath);
        log.info("注册Transform SQL: {}", registerSQL);
        iginxSession.executeSql(registerSQL);
    }

    public void delete(String name) throws Exception {
        //清理文件
        List<RegisterTaskInfoDto> registerTaskInfoDtos = query("all");
        RegisterTaskInfoDto registerTaskInfoDto = registerTaskInfoDtos.stream().filter(info -> info.getName().equals(name)).findFirst().orElse(null);
        if (registerTaskInfoDto != null) {
            if (TRANSFORM.equalsIgnoreCase(registerTaskInfoDto.getType())) {
                Path pathDir = Paths.get(SYS_DIR_PREFIX,FUNCTION_DIR_PREFIX, TRANSFORM);
                Path filePath = pathDir.resolve(registerTaskInfoDto.getFileName()).toAbsolutePath();
                if (Files.exists(filePath)) {
                    Files.delete(filePath);
                }
            } else {
                Path pathDir = Paths.get(SYS_DIR_PREFIX,FUNCTION_DIR_PREFIX, UDF);
                Path filePath = pathDir.resolve(registerTaskInfoDto.getFileName()).toAbsolutePath();
                if (Files.exists(filePath)) {
                    Files.delete(filePath);
                }
            }
        }
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
        if (TRANSFORM.equalsIgnoreCase(type)){
            return registerTaskInfoDtos.stream().filter(info -> TRANSFORM.equalsIgnoreCase(info.getType())).collect(Collectors.toList());
        } else if (UDF.equalsIgnoreCase(type)){
            return registerTaskInfoDtos.stream().filter(info -> !TRANSFORM.equalsIgnoreCase(info.getType())).collect(Collectors.toList());
        } else {
            return registerTaskInfoDtos;
        }
    }

    public void registerUDF(MultipartFile file, String udfName, String className, String udfType) throws Exception {
        // 创建函数目录
        Path pathDir = Paths.get(SYS_DIR_PREFIX,FUNCTION_DIR_PREFIX, UDF);
        if (!Files.exists(pathDir)) {
            Files.createDirectories(pathDir);
            log.info("创建函数目录: {}", pathDir);
        }

        // 保存文件到函数目录
        String fileName = file.getOriginalFilename();
        if (fileName == null || fileName.isEmpty()) {
            fileName = udfName + ".py";
        }
        Path targetPath = pathDir.resolve(fileName);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        log.info("保存UDF文件: {}", targetPath);

        String filePath = targetPath.toAbsolutePath().toString();
        // 注册UDTF
        String registerSQL =
                String.format(
                        CREATE_UDF_FORMATTER,
                        udfType,
                        udfName,
                        className,
                        filePath);
        log.info("注册UDF SQL: {}", registerSQL);
        iginxSession.executeSql(registerSQL);
    }

    public Resource downloadFunction(String fileName, String type) throws Exception {
        Path pathDir;
        if (TRANSFORM.equalsIgnoreCase(type)) {
            pathDir = Paths.get(SYS_DIR_PREFIX,FUNCTION_DIR_PREFIX, TRANSFORM);
        } else if (UDF.equalsIgnoreCase(type)) {
            pathDir = Paths.get(SYS_DIR_PREFIX,FUNCTION_DIR_PREFIX, UDF);
        } else {
            throw new Exception("不支持的函数类型: " + type);
        }

        Path filePath = pathDir.resolve(fileName).toAbsolutePath();
        if (!Files.exists(filePath)) {
            throw new Exception("文件不存在: " + filePath);
        }

        log.info("下载函数文件: {}", filePath);
        return new FileSystemResource(filePath);
    }
}
