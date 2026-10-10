package com.tsinghua.controller;

import com.tsinghua.auth.annotation.OperationLog;
import com.tsinghua.auth.annotation.RequirePermission;
import com.tsinghua.auth.enums.Permission;
import com.tsinghua.model.Result;
import com.tsinghua.service.MetaPropsValidator;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletResponse;
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
 * 关系型数据源元数据配置文件（meta_properties_path）辅助接口：
 * 上传自定义配置 / 下载配置模板。
 *
 * 说明：IGinX 按本地文件路径读取该配置（不支持通过注册接口传输文件内容），
 * 因此外传的文件由本服务代存到 sys_data 目录，再把绝对路径回填给前端。
 * sys_data 与 UDF/Transform 脚本目录一致；须保证 IGinX 进程可读（同机部署默认满足）。
 */
@Slf4j
@Api(tags = "数据资源管理")
@RestController
@RequestMapping("/api/datasource/meta-props")
public class MetaPropsController {

    /**
     * 与 UDF/Transform 脚本一致，统一存放在 sys_data 目录下
     */
    private static final String SYS_DIR_PREFIX = "sys_data";
    private static final String META_PROPS_DIR = "meta-props";
    private static final String TEMPLATE_RESOURCE = "meta-props-templates/meta-properties-template.properties";
    private static final String TEMPLATE_FILENAME = "meta-properties-template.properties";

    @ApiOperation("上传元数据配置文件，返回可填入metaPropertiesPath的绝对路径")
    @PostMapping("/upload")
    @RequirePermission(Permission.DATASOURCE_CREATE)
    @OperationLog(value = "上传元数据配置文件", type = OperationLog.OperationType.CREATE)
    public Result<String> upload(@RequestParam("file") MultipartFile file) {
        String original = file.getOriginalFilename();
        if (original == null || !original.toLowerCase().endsWith(".properties")) {
            return Result.error("仅支持 .properties 配置文件");
        }
        Properties props = new Properties();
        try (InputStream in = file.getInputStream()) {
            props.load(in);
        } catch (IOException e) {
            return Result.error("配置文件读取失败: " + e.getMessage());
        }
        String invalid = MetaPropsValidator.validateProperties(props);
        if (invalid != null) {
            return Result.error(invalid);
        }

        try {
            // 注意：MultipartFile.transferTo 会把相对路径解析到Tomcat临时目录而非工作目录，
            // 因此这里必须转成绝对路径，并用 Files.copy 写入以规避该行为
            Path dir = Paths.get(SYS_DIR_PREFIX, META_PROPS_DIR).toAbsolutePath().normalize();
            Files.createDirectories(dir);
            // 文件名清洗：仅保留安全字符，追加时间戳避免覆盖
            String base = Paths.get(original).getFileName().toString();
            base = base.substring(0, base.length() - ".properties".length())
                    .replaceAll("[^0-9A-Za-z_\\-\u4e00-\u9fa5]", "_");
            String filename = base + "-"
                    + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                    + ".properties";
            Path target = dir.resolve(filename);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
            log.info("元数据配置文件已保存: {}", target);
            return Result.success("上传成功", target.toString());
        } catch (IOException e) {
            log.error("保存元数据配置文件失败", e);
            return Result.error("保存配置文件失败: " + e.getMessage());
        }
    }

    /**
     * 下载元数据配置文件模板（全参数通用模板，不区分引擎，按注释启用对应引擎的取值）。
     * 模板随包内置，首次下载时释放到 sys_data/meta-props 目录，便于运维直接查看修改。
     */
    @ApiOperation("下载元数据配置文件模板")
    @RequestMapping(value = "/template", method = {RequestMethod.GET, RequestMethod.POST})
    public void template(HttpServletResponse response) throws IOException {
        Path template = Paths.get(SYS_DIR_PREFIX, META_PROPS_DIR, TEMPLATE_FILENAME);
        if (!Files.isRegularFile(template)) {
            Files.createDirectories(template.getParent());
            try (InputStream in = getClass().getClassLoader().getResourceAsStream(TEMPLATE_RESOURCE)) {
                if (in == null) {
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write("{\"code\":404,\"message\":\"配置文件模板资源缺失\"}");
                    return;
                }
                Files.copy(in, template);
            }
            log.info("元数据配置文件模板已释放到: {}", template.toAbsolutePath());
        }
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/octet-stream;charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=" + TEMPLATE_FILENAME);
        try (OutputStream out = response.getOutputStream()) {
            Files.copy(template, out);
            out.flush();
        }
    }
}
