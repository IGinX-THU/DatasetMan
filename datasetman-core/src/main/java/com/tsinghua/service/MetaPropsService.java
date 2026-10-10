package com.tsinghua.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Properties;

/**
 * 关系型数据源元数据配置文件（meta_properties_path）辅助服务：
 * 上传自定义配置、下载配置模板。
 *
 * 说明：IGinX 按本地文件路径读取该配置（不支持通过注册接口传输文件内容），
 * 因此外传文件由本服务代存到 sys_data 目录，再把绝对路径回填给调用方。
 * sys_data 与 UDF/Transform 脚本目录一致；须保证 IGinX 进程可读（同机部署默认满足）。
 */
@Slf4j
@Service
public class MetaPropsService {

    private static final String SYS_DIR_PREFIX = "sys_data";
    private static final String META_PROPS_DIR = "meta-props";
    private static final String TEMPLATE_RESOURCE = "meta-props-templates/meta-properties-template.properties";
    private static final String TEMPLATE_FILENAME = "meta-properties-template.properties";

    /** 上传元数据配置文件，返回可填入 metaPropertiesPath 的绝对路径 */
    public String upload(MultipartFile file) throws IOException {
        String original = file.getOriginalFilename();
        if (original == null || !original.toLowerCase().endsWith(".properties")) {
            throw new IllegalArgumentException("仅支持 .properties 配置文件");
        }
        return upload(file.getBytes(), original);
    }

    /** 从字节数组上传（RPC 入口复用），fileName 仅用于原始文件名解析与校验 */
    public String upload(byte[] bytes, String fileName) throws IOException {
        if (fileName == null || !fileName.toLowerCase().endsWith(".properties")) {
            throw new IllegalArgumentException("仅支持 .properties 配置文件");
        }
        Properties props = new Properties();
        try (InputStream in = new ByteArrayInputStream(bytes)) {
            props.load(in);
        }
        String invalid = MetaPropsValidator.validateProperties(props);
        if (invalid != null) {
            throw new IllegalArgumentException(invalid);
        }

        Path dir = Paths.get(SYS_DIR_PREFIX, META_PROPS_DIR).toAbsolutePath().normalize();
        Files.createDirectories(dir);
        String base = Paths.get(fileName).getFileName().toString();
        base = base.substring(0, base.length() - ".properties".length())
                .replaceAll("[^0-9A-Za-z_\\-\u4e00-\u9fa5]", "_");
        String filename = base + "-"
                + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + ".properties";
        Path target = dir.resolve(filename);
        try (InputStream in = new ByteArrayInputStream(bytes)) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        log.info("元数据配置文件已保存: {}", target);
        return target.toString();
    }

    /** 校验 metaPropertiesPath 指向的配置文件内容（注册数据源时 best-effort 校验） */
    public String validate(String metaPropertiesPath) {
        if (!StringUtils.hasText(metaPropertiesPath)) {
            return null;
        }
        return MetaPropsValidator.validate(metaPropertiesPath);
    }

    /** 下载模板到输出流；返回 null 表示成功，返回错误消息表示资源缺失 */
    public String writeTemplateTo(OutputStream out) throws IOException {
        Path template = Paths.get(SYS_DIR_PREFIX, META_PROPS_DIR, TEMPLATE_FILENAME);
        if (!Files.isRegularFile(template)) {
            Files.createDirectories(template.getParent());
            try (InputStream in = getClass().getClassLoader().getResourceAsStream(TEMPLATE_RESOURCE)) {
                if (in == null) {
                    return "配置文件模板资源缺失";
                }
                Files.copy(in, template);
            }
            log.info("元数据配置文件模板已释放到: {}", template.toAbsolutePath());
        }
        Files.copy(template, out);
        out.flush();
        return null;
    }

    /** 下载模板为字节数组（RPC 入口复用） */
    public byte[] downloadTemplateBytes() throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        String err = writeTemplateTo(baos);
        if (err != null) {
            throw new IOException(err);
        }
        return baos.toByteArray();
    }
}
