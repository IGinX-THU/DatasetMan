package com.tsinghua.tools;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.IginXClientFactory;
import cn.edu.tsinghua.iginx.session_v2.WriteClient;
import cn.edu.tsinghua.iginx.session_v2.write.Point;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsinghua.util.ConvertUtil;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 血缘图谱性能测试批量装载器（仅测试用途，放在 test 源码集，不参与生产构建）。
 *
 * 背景：应用创建接口每条版本需 6~7 次串行 IGinX 往返（共享单 Session），实测吞吐仅
 * 约 3 版本/秒，无法承担 20 万级造数。本工具以与 writeMeasurement 完全相同的 Point
 * 格式（measurement = 表名.列名，key = 版本id，类型化值）批量写入两张元数据表，
 * 写入格式与应用读取路径（listAllVersions/listAllEdges）逐列对齐。
 *
 * 用法：
 *   load  --datasets 3000 --edges 200000 --small 2400 --mid 200 --prefix perf_ds
 *   count                        # 统计两张表现有行数（与应用 listAll* 相同的 SQL）
 *   verify --id 1791950960000    # 按版本id读回单行，打印各列
 *   wipe  --from 1728... --to 1728...   # 按key区间物理删除（清理某轮测试数据）
 *
 * 输出与 sys_data/perf/lineage_perf_tool.py 兼容的 checkpoint/manifest 文件。
 */
public class LineageBulkLoader {

    private static final String VERSION_TABLE = "relational_system.dataset_version";
    private static final String LINEAGE_TABLE = "relational_system.dataset_lineage";
    private static final String DS_PREFIX_DEFAULT = "perf_ds";
    private static final int BATCH_POINTS = 5000;
    private static final Path PERF_DIR = Paths.get("sys_data", "perf");
    private static final Path CHECKPOINT = PERF_DIR.resolve("lineage_perf_checkpoint.jsonl");
    private static final Path MANIFEST = PERF_DIR.resolve("lineage_perf_manifest.json");

    private static final DateTimeFormatter VER_FMT =
            DateTimeFormatter.ofPattern("'v_'yyMMdd_HHmmss").withZone(ZoneId.of("Asia/Shanghai"));

    public static void main(String[] args) throws Exception {
        Map<String, String> a = parseArgs(args);
        String mode = a.getOrDefault("mode", "help");
        String host = a.getOrDefault("host", "127.0.0.1");
        int port = Integer.parseInt(a.getOrDefault("port", "6888"));

        switch (mode) {
            case "load":
                load(a, host, port);
                break;
            case "count":
                count(host, port);
                break;
            case "verify":
                verify(host, port, Long.parseLong(a.get("id")));
                break;
            case "wipe":
                wipe(host, port, Long.parseLong(a.get("from")), Long.parseLong(a.get("to")));
                break;
            default:
                System.out.println("用法: LineageBulkLoader [load|count|verify|wipe] [--key value ...]");
        }
    }

    // ==================== load ====================

    private static void load(Map<String, String> a, String host, int port) throws Exception {
        int nDatasets = Integer.parseInt(a.getOrDefault("datasets", "3000"));
        int nEdges = Integer.parseInt(a.getOrDefault("edges", "200000"));
        int nSmall = Integer.parseInt(a.getOrDefault("small", "2400"));
        int nMid = Integer.parseInt(a.getOrDefault("mid", "200"));
        String prefix = a.getOrDefault("prefix", DS_PREFIX_DEFAULT);

        int[] chainEdges = planChainEdges(nDatasets, nEdges, nSmall, nMid);
        int[][] groups = planGroups(nDatasets, nSmall, nMid);
        int nBridge = 0;
        for (int gi = 1; gi < groups.length; gi++) {
            int gs = groups[gi][0], ge = groups[gi][1];
            if (ge - gs > 1) nBridge += ge - gs - 1;
        }
        int totalVersions = nDatasets + sum(chainEdges) + nBridge;
        int totalEdges = sum(chainEdges) + 2 * nBridge;
        System.out.printf("拓扑：数据集=%d 版本=%d 链边=%d 桥接边=%d（合计边=%d）%n",
                nDatasets, totalVersions, sum(chainEdges), 2 * nBridge, totalEdges);

        // 固定起始时间、每版本 +1 秒：时间语义真实、单调、且 wipe 可按区间清理
        long base = Instant.parse("2026-09-15T00:00:00Z").toEpochMilli();
        long[][] verIds = new long[nDatasets][];
        long idCursor = base;
        for (int d = 0; d < nDatasets; d++) {
            verIds[d] = new long[chainEdges[d] + 1];
            for (int j = 0; j <= chainEdges[d]; j++) {
                verIds[d][j] = idCursor++;
            }
        }
        long[] linkIds = new long[nDatasets];
        Arrays.fill(linkIds, -1);
        for (int gi = 1; gi < groups.length; gi++) {
            for (int k = groups[gi][0] + 1; k < groups[gi][1]; k++) {
                linkIds[k] = idCursor++;
            }
        }
        long edgeIdCursor = idCursor; // 边表独立 key 空间，从版本 id 之后继续

        IginXClient client = IginXClientFactory.create(host, port, "root", "root");
        WriteClient wc = client.getWriteClient();
        Files.createDirectories(PERF_DIR);
        BufferedWriter ck = Files.newBufferedWriter(CHECKPOINT, StandardCharsets.UTF_8);
        List<Point> batch = new ArrayList<>(BATCH_POINTS + 64);

        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("datasets", nDatasets);
        plan.put("edges", nEdges);
        plan.put("small", nSmall);
        plan.put("mid", nMid);
        plan.put("prefix", prefix);
        plan.put("loader", "java");
        ck.write(new ObjectMapper().writeValueAsString(singletonMap("plan", plan)));
        ck.newLine();

        long t0 = System.currentTimeMillis();
        int created = 0;
        for (int d = 0; d < nDatasets; d++) {
            for (int j = 0; j <= chainEdges[d]; j++) {
                long vid = verIds[d][j];
                String upstreams = j == 0 ? "[]" : "[" + verIds[d][j - 1] + "]";
                addVersionPoints(batch, vid, dsName(prefix, d), upstreams);
                if (j >= 1) {
                    long edgeId = edgeIdCursor++;
                    addEdgePoints(batch, edgeId, verIds[d][j - 1], vid, "source", true);
                }
                created++;
                flushIfNeeded(wc, batch, ck);
                ck.write("{\"ds\":" + d + ",\"depth\":" + j + ",\"id\":" + vid + "}");
                ck.newLine();
                if (created % 10000 == 0) {
                    double rate = created * 1000.0 / Math.max(1, System.currentTimeMillis() - t0);
                    System.out.printf("已写 %d/%d 版本（%.0f 版本/秒）%n", created, totalVersions, rate);
                }
            }
        }

        // 桥接 linker 版本：上游 = [本数据集链尾（主），前一数据集链尾]，2 条边
        int linked = 0;
        for (int gi = 1; gi < groups.length; gi++) {
            int gs = groups[gi][0], ge = groups[gi][1];
            for (int k = gs + 1; k < ge; k++) {
                long lid = linkIds[k];
                long tailK = verIds[k][chainEdges[k]];
                long tailPrev = verIds[k - 1][chainEdges[k - 1]];
                addVersionPoints(batch, lid, dsName(prefix, k), "[" + tailK + "," + tailPrev + "]");
                long e1 = edgeIdCursor++;
                addEdgePoints(batch, e1, tailK, lid, "source", true);
                long e2 = edgeIdCursor++;
                addEdgePoints(batch, e2, tailPrev, lid, "source", false);
                linked++;
                flushIfNeeded(wc, batch, ck);
                ck.write("{\"ds\":" + k + ",\"linker\":" + (k - 1) + ",\"id\":" + lid + "}");
                ck.newLine();
            }
        }
        if (!batch.isEmpty()) {
            wc.writePoints(batch);
            batch.clear();
        }
        ck.flush();
        ck.close();

        double secs = (System.currentTimeMillis() - t0) / 1000.0;
        System.out.printf("装载完成：版本 %d（含桥接 %d），边 %d，耗时 %.1f 秒（%.0f 版本/秒）%n",
                created, linked, totalEdges, secs, created / Math.max(secs, 1e-6));
        System.out.printf("id 区间：[%d, %d]（wipe 用）%n", base, edgeIdCursor - 1);

        // manifest（与 python 工具同构，probe/浏览器测试直接使用）
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("generated_at", java.time.LocalDateTime.now().toString());
        manifest.put("plan", plan);
        List<Map<String, Object>> groupList = new ArrayList<>();
        String[] groupNames = {"small", "mid", "large"};
        for (int gi = 0; gi < groups.length; gi++) {
            Map<String, Object> g = new LinkedHashMap<>();
            g.put("name", groupNames[gi]);
            g.put("from", groups[gi][0]);
            g.put("to", groups[gi][1]);
            groupList.add(g);
        }
        manifest.put("groups", groupList);
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("datasets", nDatasets);
        counts.put("versions", created);
        counts.put("edges", totalEdges);
        manifest.put("counts", counts);
        Map<String, Object> focus = new LinkedHashMap<>();
        Map<String, Object> tails = new LinkedHashMap<>();
        for (int gi = 0; gi < groups.length; gi++) {
            int gs = groups[gi][0], ge = groups[gi][1];
            Map<String, Object> f = new LinkedHashMap<>();
            f.put("dataset", dsName(prefix, gs));
            f.put("versionId", verIds[gs][chainEdges[gs] / 2]);
            focus.put(groupNames[gi], f);
            int tailDs = ge - 1;
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("dataset", dsName(prefix, tailDs));
            t.put("versionId", linkIds[tailDs] >= 0 ? linkIds[tailDs] : verIds[tailDs][chainEdges[tailDs]]);
            tails.put(groupNames[gi], t);
        }
        manifest.put("focus", focus);
        manifest.put("tails", tails);
        Map<String, Object> idRange = new LinkedHashMap<>();
        idRange.put("from", base);
        idRange.put("to", edgeIdCursor - 1);
        manifest.put("id_range", idRange);
        new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(MANIFEST.toFile(), manifest);
        System.out.println("manifest 已写入: " + MANIFEST.toAbsolutePath());
    }

    private static void flushIfNeeded(WriteClient wc, List<Point> batch, BufferedWriter ck) throws IOException {
        if (batch.size() >= BATCH_POINTS) {
            wc.writePoints(batch);
            batch.clear();
            ck.flush();
        }
    }

    private static String dsName(String prefix, int idx) {
        return String.format("%s_%04d", prefix, idx);
    }

    /** 版本行：列名/类型与 DatasetVersionEntity 的 @Field 完全一致（id 列即 key，不单独写列） */
    private static void addVersionPoints(List<Point> batch, long key, String datasetName, String upstreams) {
        String versionNo = VER_FMT.format(Instant.ofEpochMilli(key));
        int lastDot = versionNo.lastIndexOf('.');
        String pathVersion = versionNo; // v_yymmdd_hhmmss 本身无点号，直接作路径后缀
        String storagePath = "datasets." + datasetName + "." + pathVersion;
        point(batch, VERSION_TABLE, "datasetName", datasetName, key);
        point(batch, VERSION_TABLE, "versionNo", versionNo, key);
        point(batch, VERSION_TABLE, "provenanceType", "SOURCE", key);
        point(batch, VERSION_TABLE, "storagePath", storagePath, key);
        point(batch, VERSION_TABLE, "upstreamVersionIds", upstreams, key);
        point(batch, VERSION_TABLE, "derivationConfig", "{}", key);
        point(batch, VERSION_TABLE, "schemaJson", "", key);
        point(batch, VERSION_TABLE, "rowCount", 0L, key);
        point(batch, VERSION_TABLE, "sizeBytes", 0L, key);
        point(batch, VERSION_TABLE, "createTime", key, key);
        point(batch, VERSION_TABLE, "operator", "perf", key);
        point(batch, VERSION_TABLE, "clientIp", "bulk-loader", key);
        point(batch, VERSION_TABLE, "remark", "perf bulk load", key);
        point(batch, VERSION_TABLE, "dataModality", "relational", key);
        point(batch, VERSION_TABLE, "description", "血缘图谱性能测试数据", key);
        point(batch, VERSION_TABLE, "project", "perf-test", key);
        point(batch, VERSION_TABLE, "tags", "", key);
        point(batch, VERSION_TABLE, "owner", "perf", key);
        point(batch, VERSION_TABLE, "deleted", Boolean.FALSE, key);
        point(batch, VERSION_TABLE, "jobState", -1, key);
    }

    /** 血缘边行：列名/类型与 DatasetLineageEntity 的 @Field 一致 */
    private static void addEdgePoints(List<Point> batch, long edgeId, long fromId, long toId,
                                      String relationType, boolean primary) {
        point(batch, LINEAGE_TABLE, "fromVersionId", fromId, edgeId);
        point(batch, LINEAGE_TABLE, "toVersionId", toId, edgeId);
        point(batch, LINEAGE_TABLE, "relationType", relationType, edgeId);
        point(batch, LINEAGE_TABLE, "primary", primary, edgeId);
        point(batch, LINEAGE_TABLE, "createTime", edgeId, edgeId);
    }

    private static void point(List<Point> batch, String table, String column, Object value, long key) {
        Point p = ConvertUtil.createFieldPoint(table, column, value, key);
        if (p != null) {
            batch.add(p);
        }
    }

    private static Map<String, Object> singletonMap(String k, Object v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(k, v);
        return m;
    }

    private static int sum(int[] arr) {
        int s = 0;
        for (int v : arr) s += v;
        return s;
    }

    /** 与 sys_data/perf/lineage_perf_tool.py plan_topology 完全一致 */
    static int[] planChainEdges(int n, int edges, int small, int mid) {
        int large = n - small - mid;
        int bridge = (mid > 1 ? mid - 1 : 0) + (large > 1 ? large - 1 : 0);
        int chainTotal = edges - 2 * bridge;
        int base = chainTotal / n, rem = chainTotal % n;
        int[] ce = new int[n];
        for (int i = 0; i < n; i++) ce[i] = base + (i < rem ? 1 : 0);
        return ce;
    }

    /** 返回 {起始,结束)} 数组，第 0 组为 small（不桥接） */
    static int[][] planGroups(int n, int small, int mid) {
        List<int[]> g = new ArrayList<>();
        g.add(new int[]{0, small});
        if (mid > 0) g.add(new int[]{small, small + mid});
        if (n > small + mid) g.add(new int[]{small + mid, n});
        return g.toArray(new int[0][]);
    }

    // ==================== count / verify / wipe ====================

    private static void count(String host, int port) throws Exception {
        Session s = openSession(host, port);
        try {
            countTable(s, VERSION_TABLE);
            countTable(s, LINEAGE_TABLE);
        } finally {
            closeQuietly(s);
        }
    }

    private static void countTable(Session s, String table) throws Exception {
        SessionExecuteSqlResult r = s.executeSql(String.format("select createTime from %s;", table));
        System.out.printf("%s: %d 行%n", table, r.getValues().size());
    }

    private static void verify(String host, int port, long id) throws Exception {
        Session s = openSession(host, port);
        try {
            dumpRow(s, VERSION_TABLE, id);
            dumpRow(s, LINEAGE_TABLE, id);
        } finally {
            closeQuietly(s);
        }
    }

    private static void dumpRow(Session s, String table, long id) throws Exception {
        SessionExecuteSqlResult r = s.executeSql(
                String.format("select * from %s where createTime = %d;", table, id));
        List<String> header = r.getPaths();
        List<List<Object>> rows = r.getValues();
        System.out.println("== " + table + " (createTime=" + id + ") 命中 " + rows.size() + " 行");
        for (List<Object> row : rows) {
            Map<String, Object> rec = new LinkedHashMap<>();
            for (int i = 0; i < header.size() && i < row.size(); i++) {
                Object v = row.get(i);
                rec.put(header.get(i), v instanceof byte[]
                        ? new String((byte[]) v, StandardCharsets.UTF_8) : v);
            }
            System.out.println("  " + rec);
        }
    }

    private static void wipe(String host, int port, long from, long to) throws Exception {
        Session s = openSession(host, port);
        try {
            for (String table : new String[]{VERSION_TABLE, LINEAGE_TABLE}) {
                List<String> cols = columnsOf(s, table);
                int done = 0;
                for (String col : cols) {
                    try {
                        s.deleteDataInColumn(col, from, to);
                        done++;
                    } catch (Exception e) {
                        System.out.println("delete 失败(" + col + "): " + e.getMessage());
                    }
                }
                System.out.printf("%s: 已按区间删除 %d/%d 列%n", table, done, cols.size());
            }
            countTable(s, VERSION_TABLE);
            countTable(s, LINEAGE_TABLE);
        } finally {
            closeQuietly(s);
        }
    }

    private static List<String> columnsOf(Session s, String table) throws Exception {
        SessionExecuteSqlResult r = s.executeSql(String.format("select * from %s;", table));
        return r.getPaths();
    }

    private static Session openSession(String host, int port) throws Exception {
        Session s = new Session(host, port, "root", "root");
        s.openSession();
        return s;
    }

    private static void closeQuietly(Session s) {
        try {
            s.closeSession();
        } catch (Exception e) {
            System.out.println("关闭会话异常: " + e.getMessage());
        }
    }

    private static Map<String, String> parseArgs(String[] args) {
        Map<String, String> m = new LinkedHashMap<>();
        if (args.length > 0) m.put("mode", args[0]);
        for (int i = 1; i < args.length; i++) {
            String k = args[i];
            if (k.startsWith("--")) {
                m.put(k.substring(2), i + 1 < args.length ? args[++i] : "true");
            }
        }
        return m;
    }
}
