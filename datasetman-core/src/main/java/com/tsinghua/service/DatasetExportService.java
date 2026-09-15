package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import com.itextpdf.html2pdf.resolver.font.DefaultFontProvider;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.entity.QualityAssessmentEntity;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 数据集打包导出：将某数据集树下全部版本的数据表（CSV）、
 * 标准化清单 manifest.json、最新质量评估报告（HTML转PDF，带单位水印）
 * 打包为 zip 下载，用于标准化导出与跨系统共享。
 * PDF 转换参考 DataModelGov SimulationExecutionService（iText7 + html2pdf + 系统中文字体）。
 */
@Slf4j
@Service
public class DatasetExportService {

    private static final String WATERMARK_TEXT = "清华大学大数据系统软件国家工程研究中心";

    @Autowired
    private Session iginxSession;

    @Autowired
    private DatasetVersionService datasetVersionService;

    @Autowired
    private DatasetManifestService datasetManifestService;

    @Autowired
    private QualityAssessmentService qualityAssessmentService;

    /**
     * 打包导出当前版本：
     * 该版本数据表 CSV（覆盖其下全部数据） + manifest.json + 质量评估报告PDF。
     */
    public byte[] exportPackage(Long versionId) throws IOException {
        DatasetVersionEntity version = datasetVersionService.queryVersion(versionId);
        if (version == null) {
            throw new RuntimeException("版本不存在: " + versionId);
        }
        String datasetName = version.getDatasetName();

        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bos)) {
            // 1. 当前版本数据：按表导出，每张表一个CSV（表名为存储路径叶子列的父节点，
            //    表头去掉 "datasets.<数据集>.<版本>.<表名>." 前缀，只保留列名）
            exportVersionTables(zip, version);

            // 2. 标准化清单
            JSONObject manifest = datasetManifestService.buildManifest(version);
            zipEntry(zip, "manifest.json", manifest.toJSONString().getBytes(StandardCharsets.UTF_8));

            // 3. 质量评估报告 PDF（该数据集最新一条测评记录）
            try {
                QualityAssessmentEntity assessment = qualityAssessmentService.queryLatestByDatasetName(datasetName);
                if (assessment != null && assessment.getReportJson() != null && !assessment.getReportJson().isEmpty()) {
                    String html = buildReportHtml(assessment);
                    byte[] pdf = htmlToPdf(html);
                    zipEntry(zip, "质量评估报告.pdf", pdf);
                }
            } catch (Exception e) {
                log.warn("质量评估报告PDF生成失败，跳过: {}", e.getMessage());
                byte[] note = ("质量评估报告生成失败: " + e.getMessage()).getBytes(StandardCharsets.UTF_8);
                zipEntry(zip, "质量评估报告-生成失败.txt", note);
            }
        }
        return bos.toByteArray();
    }

    /** 导出文件名：数据集名-版本号.zip */
    public String buildFileName(String datasetName, String versionNo) {
        String safe = datasetName == null ? "dataset" : datasetName.replaceAll("[\\/:*?\"<>|]", "_");
        return safe + "-" + (versionNo == null ? "export" : sanitize(versionNo)) + ".zip";
    }

    private void zipEntry(ZipOutputStream zip, String name, byte[] bytes) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(bytes);
        zip.closeEntry();
    }

    /**
     * 按表导出当前版本：一次查询版本前缀下全部数据（与数据视图同源，保证有数据），
     * 在内存中按表名（完整路径倒数第二段）分组切分，每张表一个 CSV，
     * 表头去掉 "datasets.<数据集>.<版本>.<表名>." 前缀，只保留列名。
     * 注意：IGinX 不支持对子前缀二次 select（会返回空），因此必须复用同一份查询结果。
     */
    private void exportVersionTables(ZipOutputStream zip, DatasetVersionEntity v) throws IOException {
        try {
            SessionExecuteSqlResult all = iginxSession.executeSql(
                    String.format("select * from %s;", v.getStoragePath()));
            List<String> paths = all.getPaths();
            List<Map<String, Object>> records = ConvertUtil.getRecords(all);
            if (paths == null || paths.isEmpty()) {
                zipEntry(zip, "导出说明.txt", "该版本下未查询到数据".getBytes(StandardCharsets.UTF_8));
                return;
            }
            // 表名 = 完整路径倒数第二段（最后一段为列名）；按表分组列
            Map<String, List<String>> columnsByTable = new LinkedHashMap<>();
            for (String p : paths) {
                String[] seg = p.split("\\.");
                String table = seg.length >= 2 ? seg[seg.length - 2] : "data";
                columnsByTable.computeIfAbsent(table, k -> new ArrayList<>()).add(p);
            }
            for (Map.Entry<String, List<String>> entry : columnsByTable.entrySet()) {
                byte[] csv = buildTableCsv(entry.getValue(), records);
                zipEntry(zip, sanitize(entry.getKey()) + ".csv", csv);
            }
        } catch (Exception e) {
            log.warn("版本按表导出失败 storagePath={}: {}", v.getStoragePath(), e.getMessage());
            zipEntry(zip, "导出说明.txt", ("导出失败: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /** 由同一份查询结果按列子集生成单表 CSV：表头仅保留叶子列名 */
    private byte[] buildTableCsv(List<String> tablePaths, List<Map<String, Object>> records) {
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF');
        for (int i = 0; i < tablePaths.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(csvEscape(shortName(tablePaths.get(i))));
        }
        sb.append('\r').append('\n');
        for (Map<String, Object> row : records) {
            for (int i = 0; i < tablePaths.size(); i++) {
                if (i > 0) sb.append(',');
                Object val = row.get(tablePaths.get(i));
                sb.append(csvEscape(val == null ? "" : String.valueOf(val)));
            }
            sb.append('\r').append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }


    private static String csvEscape(String s) {
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return '"' + s.replace("\"", "\"\"") + '"';
        }
        return s;
    }

    private static String shortName(String path) {
        if (path == null) return "";
        int idx = path.lastIndexOf('.');
        return idx >= 0 ? path.substring(idx + 1) : path;
    }

    private static String sanitize(String s) {
        return s == null ? "version" : s.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    /** 由 reportJson 渲染带水印的评估报告HTML */
    private String buildReportHtml(QualityAssessmentEntity assessment) {
        JSONObject report = JSONObject.parseObject(assessment.getReportJson());
        StringBuilder sb = new StringBuilder();
        sb.append("<html><head><meta charset='UTF-8'/><style>")
          .append("body{font-family:SimSun,'Microsoft YaHei';font-size:11pt;color:#333;position:relative;}")
          .append("h2{text-align:center;border-bottom:2px solid #1890ff;padding-bottom:8px;}")
          .append("table{border-collapse:collapse;width:100%;margin:10px 0;}")
          .append("th,td{border:1px solid #bbb;padding:6px 8px;font-size:10pt;}")
          .append("th{background:#f2f2f2;}")
          .append(".wm{position:absolute;top:220px;left:0;width:100%;text-align:center;")
          .append("font-size:38pt;color:#999999;opacity:0.13;font-weight:bold;transform:rotate(-20deg);}")
          .append(".meta{color:#666;font-size:10pt;}")
          .append("</style></head><body>");
        sb.append("<div class='wm'>").append(WATERMARK_TEXT).append("</div>");
        sb.append("<h2>数据集质量评估报告</h2>");
        sb.append("<p class='meta'>数据集：").append(esc(assessment.getDatasetName()))
          .append("　版本：").append(esc(assessment.getVersionNo()))
          .append("　评价准则：").append(esc(assessment.getCriteriaName()))
          .append("　测评时间：").append(assessment.getCreateTime() == null ? "-"
                : new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date(assessment.getCreateTime())))
          .append("　测评人：").append(esc(assessment.getOperator()))
          .append("</p>");
        sb.append("<p>综合得分 DQI：<b>").append(esc(report.getString("score"))).append("</b>（权重加权，达标线95分）　质量等级：<b>")
          .append(esc(report.getString("grade"))).append("</b>　")
          .append(Boolean.TRUE.equals(report.getBoolean("passed")) ? "<font color='#389e0d'>达标</font>" : "<font color='#cf1322'>未达标</font>")
          .append("</p>");
        sb.append("<p>").append(esc(report.getString("conclusion"))).append("</p>");
        sb.append("<table><tr><th>维度</th><th>得分</th><th>权重</th><th>评级</th><th>评分依据（不满足规则的数据项摘要）</th></tr>");
        JSONArray dims = report.getJSONArray("dimensions");
        if (dims != null) {
            for (int i = 0; i < dims.size(); i++) {
                JSONObject d = dims.getJSONObject(i);
                sb.append("<tr><td>").append(esc(d.getString("name")))
                  .append("</td><td>").append(esc(d.getString("score")))
                  .append("</td><td>").append(d.getDouble("weight") == null ? "-" : d.getDoubleValue("weight") * 100 + "%")
                  .append("</td><td>").append(esc(d.getString("grade")))
                  .append("</td><td>").append(esc(d.getString("evidence"))).append("</td></tr>");
            }
        }
        sb.append("</table>");
        sb.append("<p><b>问题明细</b></p>");
        JSONArray issues = report.getJSONArray("issues");
        if (issues != null) issues.forEach(i -> sb.append("<p>· ").append(esc(String.valueOf(i))).append("</p>"));
        sb.append("<p><b>整改建议</b></p>");
        JSONArray recs = report.getJSONArray("recommendations");
        if (recs != null) recs.forEach(i -> sb.append("<p>· ").append(esc(String.valueOf(i))).append("</p>"));
        sb.append("<p class='meta'>报告生成时间: ").append(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date())).append("</p>");
        sb.append("</body></html>");
        return sb.toString();
    }

    private static String esc(String s) {
        return s == null ? "-" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /** iText7 + html2pdf HTML转PDF（注册系统中文字体，参考 DataModelGov SimulationExecutionService） */
    private byte[] htmlToPdf(String html) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(out);
        PdfDocument pdfDocument = new PdfDocument(writer);
        pdfDocument.setDefaultPageSize(com.itextpdf.kernel.geom.PageSize.A4);
        ConverterProperties properties = new ConverterProperties();
        DefaultFontProvider fontProvider = new DefaultFontProvider(false, false, false);
        String[] fontPaths = {
                "C:/Windows/Fonts/simsun.ttc", "C:/Windows/Fonts/msyh.ttc",
                "C:/Windows/Fonts/simhei.ttf", "/usr/share/fonts/truetype/simsun/simsun.ttc"
        };
        for (String path : fontPaths) {
            try {
                fontProvider.addFont(path);
            } catch (Exception ignore) {
                // 字体不存在时跳过
            }
        }
        properties.setFontProvider(fontProvider);
        HtmlConverter.convertToPdf(html, pdfDocument, properties);
        return out.toByteArray();
    }
}
