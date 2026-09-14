package com.tsinghua.service;

import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.entity.DatasetLineageEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;

/**
 * 数据集标准化导出（数据包清单）：
 * 按统一目录规范导出 manifest.json（元数据、版本、血缘、分类信息），
 * 供跨系统共享时对数据集做标准化登记与校验。
 */
@Slf4j
@Service
public class DatasetManifestService {

    @Autowired
    private DatasetVersionService datasetVersionService;

    @Value("${dataset.export.dir:sys_data/export}")
    private String exportDir;

    /**
     * 生成并落盘标准化数据集清单。
     *
     * @return manifest JSON（同时作为响应返回）
     */
    public JSONObject exportManifest(Long versionId) throws IOException {
        DatasetVersionEntity version = datasetVersionService.queryVersion(versionId);
        if (version == null) {
            throw new RuntimeException("版本不存在: " + versionId);
        }

        JSONObject manifest = buildManifest(version);
        Path dir = Paths.get(exportDir,
                sanitize(version.getDatasetName()) + "-" + version.getVersionNo());
        Files.createDirectories(dir);
        Path file = dir.resolve("manifest.json");
        Files.write(file, manifest.toJSONString().getBytes(StandardCharsets.UTF_8));
        log.info("标准化数据集清单已导出: {}", file.toAbsolutePath());
        return manifest;
    }

    private JSONObject buildManifest(DatasetVersionEntity version) {
        JSONObject m = new JSONObject(new LinkedHashMap<>());
        m.put("manifestVersion", "1.0");
        m.put("manifestType", "aero-engine-dataset-package");
        m.put("generatedAt", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));

        // 1. 数据集标识与元数据
        JSONObject dataset = new JSONObject(new LinkedHashMap<>());
        dataset.put("name", version.getDatasetName());
        dataset.put("versionNo", version.getVersionNo());
        dataset.put("versionId", version.getId());
        dataset.put("description", version.getDescription());
        dataset.put("project", version.getProject());
        dataset.put("owner", version.getOwner());
        dataset.put("tags", version.getTags());
        dataset.put("dataModality", version.getDataModality());
        dataset.put("schema", safeJson(version.getSchemaJson()));
        dataset.put("rowCount", version.getRowCount());
        dataset.put("sizeBytes", version.getSizeBytes());
        dataset.put("storagePath", version.getStoragePath());
        dataset.put("provenanceType", version.getProvenanceType());
        dataset.put("createTime", version.getCreateTime());
        dataset.put("license", "内部受限共享（仅限项目授权系统使用）");
        m.put("dataset", dataset);

        // 2. 血缘：上游版本链与下游影响
        JSONObject lineage = new JSONObject();
        JSONArray upstreams = new JSONArray();
        datasetVersionService.parseUpstreamIds(version).forEach(uid -> {
            DatasetVersionEntity up = datasetVersionService.queryVersion(uid);
            JSONObject u = new JSONObject();
            u.put("versionId", uid);
            if (up != null) {
                u.put("datasetName", up.getDatasetName());
                u.put("versionNo", up.getVersionNo());
            }
            upstreams.add(u);
        });
        lineage.put("upstreams", upstreams);
        JSONArray downstreams = new JSONArray();
        List<DatasetLineageEntity> edges = datasetVersionService.listDownstreamEdges(
                version.getId() != null ? version.getId() : version.getCreateTime());
        edges.forEach(e -> {
            DatasetVersionEntity down = datasetVersionService.queryVersion(e.getToVersionId());
            JSONObject d = new JSONObject();
            d.put("versionId", e.getToVersionId());
            d.put("relationType", e.getRelationType());
            if (down != null) {
                d.put("datasetName", down.getDatasetName());
                d.put("versionNo", down.getVersionNo());
            }
            downstreams.add(d);
        });
        lineage.put("downstreams", downstreams);
        m.put("lineage", lineage);

        // 3. 共享校验信息
        JSONObject integrity = new JSONObject();
        integrity.put("deleted", version.isDeleted());
        integrity.put("jobState", version.getJobState());
        integrity.put("shareable", !version.isDeleted());
        m.put("integrity", integrity);

        return m;
    }

    private static Object safeJson(String json) {
        if (json == null || json.isEmpty()) return new JSONObject();
        try {
            return JSONObject.parse(json);
        } catch (Exception e) {
            return json;
        }
    }

    private static String sanitize(String s) {
        return s == null ? "dataset" : s.replaceAll("[^a-zA-Z0-9_\\-\\u4e00-\\u9fa5]", "_");
    }
}
