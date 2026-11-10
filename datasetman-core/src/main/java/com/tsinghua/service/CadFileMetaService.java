package com.tsinghua.service;

import io.jhdf.api.Attribute;
import io.jhdf.api.Dataset;
import io.jhdf.api.Group;
import io.jhdf.api.Node;
import io.jhdf.api.NodeType;
import io.jhdf.HdfFile;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CAD/CAE 文件元数据识别服务：
 *   .pmdb  ANSYS Fluent Meshing 几何/网格数据库（实证样本为 HDF5 容器，
 *          魔数 89 48 44 46 0d 0a 1a 0a，内含 Part Manager Stream / BRep Stream），
 *          用 jhdf 解析 HDF5 结构树（只读头信息，不读取数据集内容）
 *   .prt   西门子 NX 原生格式（专有二进制，识别 UGII 特征串）
 *   .stl / .msh / .step / .stp / .iges / .igs
 *          公开格式，仅做容器级识别（详细解析在前端完成）
 */
@Slf4j
@Service
public class CadFileMetaService {

    /** HDF5 规范魔数 */
    private static final byte[] HDF5_MAGIC = {(byte) 0x89, 'H', 'D', 'F', '\r', '\n', 0x1a, '\n'};

    /** PMDB 特征流名称（实测样本中存在，用于佐证 ANSYS PMDB） */
    private static final String[] PMDB_MARKERS = {"Part Manager Stream", "BRep Stream"};

    /** NX .prt 特征串 */
    private static final String NX_MARKER = "UGII";

    /** 树遍历限制，防止异常文件拖垮接口 */
    private static final int MAX_TREE_DEPTH = 4;
    private static final int MAX_CHILDREN_PER_GROUP = 50;
    private static final int MAX_TOTAL_NODES = 500;
    private static final int MAX_ATTR_VALUE_LENGTH = 200;

    public Map<String, Object> analyze(byte[] bytes, String fileName) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fileName", fileName);
        result.put("sizeBytes", bytes == null ? 0 : bytes.length);

        String extension = extractExtension(fileName);
        result.put("extension", extension);
        result.put("format", detectFormat(bytes, extension));

        if (bytes != null && isHdf5(bytes)) {
            result.put("formatName", "pmdb".equals(extension) ? "ANSYS PMDB (HDF5)" : "HDF5");
            result.put("markers", findMarkers(bytes, PMDB_MARKERS));
            try {
                result.put("hdf5", parseHdf5Tree(bytes));
            } catch (Exception e) {
                log.warn("HDF5结构解析失败: {}", fileName, e);
                result.put("hdf5Error", e.getMessage());
            }
        } else if (bytes != null && findMarkers(bytes, new String[]{NX_MARKER}).size() > 0) {
            result.put("formatName", "Siemens NX Part (.prt)");
            result.put("markers", findMarkers(bytes, new String[]{NX_MARKER}));
        }

        return result;
    }

    private String extractExtension(String fileName) {
        if (fileName == null) {
            return "";
        }
        int dot = fileName.lastIndexOf('.');
        return dot >= 0 ? fileName.substring(dot + 1).toLowerCase() : "";
    }

    /**
     * 容器/格式判定：优先魔数，其次扩展名
     */
    private String detectFormat(byte[] bytes, String extension) {
        if (bytes == null || bytes.length < 8) {
            return "UNKNOWN";
        }
        if (isHdf5(bytes)) {
            return "HDF5";
        }
        if (bytes.length >= 2 && bytes[0] == 'P' && bytes[1] == 'K') {
            return "ZIP";
        }
        switch (extension) {
            case "stl":
                return "STL";
            case "msh":
                return "FLUENT_MESH";
            case "step":
            case "stp":
                return "STEP";
            case "iges":
            case "igs":
                return "IGES";
            case "pmdb":
                return "PMDB";
            case "prt":
                return "NX_PART";
            default:
                return "UNKNOWN";
        }
    }

    private boolean isHdf5(byte[] bytes) {
        for (int i = 0; i < HDF5_MAGIC.length; i++) {
            if (bytes[i] != HDF5_MAGIC[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * 在二进制中查找 ASCII 特征串（如 PMDB 流名、UGII）
     */
    private List<String> findMarkers(byte[] bytes, String[] markers) {
        List<String> found = new ArrayList<>();
        if (bytes == null) {
            return found;
        }
        String latin1 = new String(bytes, StandardCharsets.ISO_8859_1);
        for (String marker : markers) {
            if (latin1.contains(marker)) {
                found.add(marker);
            }
        }
        return found;
    }

    /**
     * 用 jhdf 解析 HDF5 结构树（限深限宽，不读数据集内容）
     */
    private Map<String, Object> parseHdf5Tree(byte[] bytes) {
        int[] budget = {MAX_TOTAL_NODES};
        try (HdfFile hdfFile = HdfFile.fromBytes(bytes)) {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("attributes", stringifyAttributes(hdfFile.getAttributes()));
            List<Map<String, Object>> children = new ArrayList<>();
            boolean[] truncated = {false};
            collectChildren(hdfFile, 1, budget, children, truncated);
            root.put("children", children);
            root.put("truncated", truncated[0]);
            return root;
        }
    }

    private void collectChildren(Group group, int depth, int[] budget,
                                 List<Map<String, Object>> output, boolean[] truncated) {
        if (depth > MAX_TREE_DEPTH || budget[0] <= 0) {
            truncated[0] = true;
            return;
        }
        int counted = 0;
        for (Map.Entry<String, Node> entry : group.getChildren().entrySet()) {
            if (counted >= MAX_CHILDREN_PER_GROUP || budget[0] <= 0) {
                truncated[0] = true;
                break;
            }
            counted++;
            budget[0]--;
            Node node = entry.getValue();
            Map<String, Object> json = new LinkedHashMap<>();
            json.put("name", node.getName());
            json.put("type", nodeTypeString(node.getType()));
            json.put("attributes", stringifyAttributes(node.getAttributes()));
            if (node instanceof Dataset) {
                Dataset dataset = (Dataset) node;
                json.put("dims", dataset.getDimensions());
                json.put("javaType", dataset.getJavaType() == null ? null : dataset.getJavaType().getSimpleName());
                json.put("sizeBytes", dataset.getSizeInBytes());
            }
            if (node instanceof Group) {
                List<Map<String, Object>> children = new ArrayList<>();
                json.put("children", children);
                collectChildren((Group) node, depth + 1, budget, children, truncated);
            }
            output.add(json);
        }
    }

    private String nodeTypeString(NodeType type) {
        if (type == NodeType.GROUP) {
            return "GROUP";
        }
        if (type == NodeType.DATASET) {
            return "DATASET";
        }
        if (type == NodeType.COMMITTED_DATATYPE) {
            return "COMMITTED_DATATYPE";
        }
        return type == null ? "UNKNOWN" : type.name();
    }

    /**
     * 属性值统一转字符串展示（截断超长值）
     */
    private Map<String, String> stringifyAttributes(Map<String, Attribute> attributes) {
        Map<String, String> json = new LinkedHashMap<>();
        if (attributes == null) {
            return json;
        }
        for (Map.Entry<String, Attribute> entry : attributes.entrySet()) {
            try {
                Object data = entry.getValue().getData();
                json.put(entry.getKey(), truncate(stringifyValue(data)));
            } catch (Exception e) {
                json.put(entry.getKey(), "<读取失败>");
            }
        }
        return json;
    }

    private String stringifyValue(Object data) {
        if (data == null) {
            return null;
        }
        if (data instanceof byte[]) {
            return new String((byte[]) data, StandardCharsets.UTF_8).trim();
        }
        if (data instanceof char[]) {
            return new String((char[]) data).trim();
        }
        Class<?> componentType = data.getClass().getComponentType();
        if (componentType != null) {
            if (componentType == Byte.TYPE) {
                return new String((byte[]) data, StandardCharsets.UTF_8).trim();
            }
            return Arrays.deepToString(box(data));
        }
        return String.valueOf(data);
    }

    /**
     * 多维原始数组转 Object[][] 便于 deepToString（浅层足够）
     */
    private Object[] box(Object array) {
        int length = java.lang.reflect.Array.getLength(array);
        Object[] boxed = new Object[length];
        for (int i = 0; i < length; i++) {
            Object element = java.lang.reflect.Array.get(array, i);
            if (element != null && element.getClass().isArray() && element.getClass().getComponentType().isPrimitive()) {
                boxed[i] = box(element);
            } else {
                boxed[i] = element;
            }
        }
        return boxed;
    }

    private String truncate(String value) {
        if (value == null) {
            return null;
        }
        if (value.length() <= MAX_ATTR_VALUE_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_ATTR_VALUE_LENGTH) + "...(截断)";
    }
}
