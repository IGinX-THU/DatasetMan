package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.tsinghua.auth.aspect.OperationLogAspect;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.DatasetCreateRequest;
import com.tsinghua.dto.LineageForkRequest;
import com.tsinghua.dto.LineageForkRunDTO;
import com.tsinghua.dto.SqlSnippetRequest;
import com.tsinghua.dto.TaskInfoDto;
import com.tsinghua.dto.TransformJobRequest;
import com.tsinghua.entity.DatasetLineageEntity;
import com.tsinghua.entity.DatasetVersionEntity;
import com.tsinghua.entity.LineageForkRunEntity;
import com.tsinghua.entity.SqlSnippetEntity;
import com.tsinghua.entity.TransformCompareEntity;
import com.tsinghua.entity.TransformJobEntity;
import com.tsinghua.enums.ProvenanceType;
import com.tsinghua.util.CommonUtil;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import cn.edu.tsinghua.iginx.session.Session;

import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 血缘路径重跑（分叉）服务：沿选中路径逐节点重跑，每个数据集生成同名新版本，
 * 形成独立的新版本树。
 *
 * 语义：
 * - 起点 SOURCE：同 sourcePath 重新登记挂载版本（独立根）；
 * - 起点 SQL_QUERY：重跑 SQL 物化，新版本无父级（显式独立根），${upstream} 仍绑定原首上游；
 * - 中间 SQL/TRANSFORM：上游引用重映射到路径上新版本后重跑，SQL 文本中的旧存储路径（表名）替换为新路径；
 * - 重跑用到的 SQL 脚本 / Transform 编排一律克隆为新记录（_fork 后缀），不改动原件；
 * - 新版本统一登记显式 upstreamVersionIds（旧ID→新ID），不触发自动同名挂链。
 */
@Slf4j
@Service
public class LineageForkService {

    private static final String RUN_PREFIX = "relational_system.lineage_fork_run";

    /** Transform 作业轮询间隔与总超时 */
    private static final long TRANSFORM_POLL_INTERVAL_MS = 3000;
    private static final long TRANSFORM_TIMEOUT_MS = 15 * 60 * 1000;

    @Autowired
    private DatasetVersionService datasetVersionService;

    @Autowired
    private DatasetCreationService datasetCreationService;

    @Autowired
    private SqlSnippetService sqlSnippetService;

    @Autowired
    private TransformCompareService transformCompareService;

    @Autowired
    private TransformJobService transformJobService;

    @Autowired
    private IginXClient iginxClient;

    @Autowired
    private Session iginxSession;

    /** 重跑链必须按序执行（下游依赖上游物化完成），单线程串行化即可 */
    private final ExecutorService forkExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "lineage-fork");
        t.setDaemon(true);
        return t;
    });

    /** 克隆脚本命名序号：同一毫秒内多次克隆（如同编排内多个任务）避免重名 */
    private static final AtomicLong FORK_NAME_SEQ = new AtomicLong();

    // ====================================================================
    // 启动与校验
    // ====================================================================

    /** 启动一次路径重跑：校验通过后落库运行记录并异步编排，立即返回 runId */
    public LineageForkRunDTO startFork(LineageForkRequest request) {
        if (request.getPathVersionIds() == null || request.getPathVersionIds().isEmpty()) {
            throw new IllegalArgumentException("重跑路径不能为空");
        }
        if (!request.getPathVersionIds().get(0).equals(request.getForkVersionId())) {
            throw new IllegalArgumentException("路径首版本必须与分叉起始版本一致");
        }

        List<DatasetVersionEntity> path = loadAndValidatePath(request.getPathVersionIds());

        // 初始步骤快照
        List<LineageForkRunDTO.Step> steps = new ArrayList<>();
        for (DatasetVersionEntity v : path) {
            LineageForkRunDTO.Step step = new LineageForkRunDTO.Step();
            step.setOriginVersionId(versionKey(v));
            step.setDatasetName(v.getDatasetName());
            step.setOriginVersionNo(v.getVersionNo());
            step.setProvenanceType(v.getProvenanceType());
            step.setStatus("PENDING");
            steps.add(step);
        }

        long runId = System.currentTimeMillis();
        LineageForkRunEntity run = new LineageForkRunEntity();
        run.setId(runId);
        run.setStatus("RUNNING");
        run.setOperator(AuthUtil.getCurrentUsername());
        run.setClientIp(OperationLogAspect.getClientIp());
        run.setTotalSteps(steps.size());
        run.setCurrentStepIndex(-1);
        run.setStepsJson(JSONObject.toJSONString(steps));
        run.setMessage("");
        run.setCreateTime(runId);
        writeRun(run);

        // 捕获请求线程的认证上下文，供工作线程内 AuthUtil / OperationLogAspect 正常取到操作人
        SecurityContext securityContext = SecurityContextHolder.getContext();
        forkExecutor.submit(() -> {
            SecurityContextHolder.setContext(securityContext);
            try {
                executeFork(run, request, path, steps);
            } catch (Exception e) {
                log.error("血缘路径重跑 run={} 未捕获异常", runId, e);
            } finally {
                SecurityContextHolder.clearContext();
            }
        });

        return toDTO(run);
    }

    /** 加载并整体校验路径：存在性、权限、节点类型、相邻血缘连续性 */
    private List<DatasetVersionEntity> loadAndValidatePath(List<Long> pathIds) {
        List<DatasetVersionEntity> path = new ArrayList<>();
        for (Long vid : pathIds) {
            DatasetVersionEntity v = datasetVersionService.queryVersion(vid);
            if (v == null) {
                throw new IllegalArgumentException("数据集版本不存在: " + vid);
            }
            if (v.isDeleted()) {
                throw new IllegalArgumentException("数据集版本已禁用: " + v.getDatasetName() + "/" + v.getVersionNo());
            }
            assertOwnerPermission(v);
            path.add(v);
        }

        for (int i = 0; i < path.size(); i++) {
            // 起点与终点不限类型（任意版本节点均可）；仅校验产出方式可识别 + 相邻节点间存在直接血缘
            provenanceOf(path.get(i));
            if (i > 0 && !isAdjacent(path.get(i - 1), path.get(i))) {
                throw new IllegalArgumentException("所选路径不连续："
                        + path.get(i - 1).getDatasetName() + "/" + path.get(i - 1).getVersionNo()
                        + " 与 " + path.get(i).getDatasetName() + "/" + path.get(i).getVersionNo()
                        + " 之间不存在直接血缘");
            }
        }
        return path;
    }

    private void assertOwnerPermission(DatasetVersionEntity v) {
        if (AuthUtil.isAdmin()) {
            return;
        }
        String user = AuthUtil.getCurrentUsername();
        if (user == null || !user.equals(v.getOwner())) {
            throw new IllegalArgumentException("无权重跑数据集 " + v.getDatasetName() + "/" + v.getVersionNo() + "（仅创建者或管理员可操作）");
        }
    }

    /** 相邻判定：权威来源是下游版本的 upstreamVersionIds，边表兜底 */
    private boolean isAdjacent(DatasetVersionEntity upstream, DatasetVersionEntity downstream) {
        Long from = versionKey(upstream);
        Long to = versionKey(downstream);
        if (datasetVersionService.parseUpstreamIds(downstream).contains(from)) {
            return true;
        }
        for (DatasetLineageEntity e : datasetVersionService.listAllEdges()) {
            if (from.equals(e.getFromVersionId()) && to.equals(e.getToVersionId())) {
                return true;
            }
        }
        return false;
    }

    private ProvenanceType provenanceOf(DatasetVersionEntity v) {
        try {
            return ProvenanceType.of(v.getProvenanceType());
        } catch (Exception e) {
            throw new IllegalArgumentException("无法识别的产出方式: " + v.getProvenanceType());
        }
    }

    // ====================================================================
    // 编排执行（工作线程，已恢复认证上下文）
    // ====================================================================

    private void executeFork(LineageForkRunEntity run, LineageForkRequest request,
                             List<DatasetVersionEntity> path, List<LineageForkRunDTO.Step> steps) {
        Map<Long, Long> idMap = new HashMap<>();            // 旧版本ID -> 新版本ID
        Map<String, String> pathReplacements = new HashMap<>(); // 旧存储路径 -> 新存储路径（SQL 表名替换用）
        try {
            for (int i = 0; i < path.size(); i++) {
                DatasetVersionEntity origin = path.get(i);
                LineageForkRunDTO.Step step = steps.get(i);
                run.setCurrentStepIndex(i);
                step.setStatus("RUNNING");
                persistRun(run, steps);

                try {
                    DatasetVersionEntity created = executeStep(origin, i == 0, request.getStepEdits(), idMap, pathReplacements);
                    Long newId = versionKey(created);
                    idMap.put(versionKey(origin), newId);
                    pathReplacements.put(origin.getStoragePath(), created.getStoragePath());
                    step.setStatus("SUCCESS");
                    step.setNewVersionId(newId);
                    step.setNewVersionNo(created.getVersionNo());
                    step.setMessage("");
                    log.info("血缘路径重跑 run={} 步骤 {}/{} 完成: {} {} -> {} {}",
                            run.getId(), i + 1, path.size(), origin.getDatasetName(), origin.getVersionNo(),
                            created.getDatasetName(), created.getVersionNo());
                } catch (Exception e) {
                    log.error("血缘路径重跑 run={} 步骤 {}/{} 失败: {} {}",
                            run.getId(), i + 1, path.size(), origin.getDatasetName(), origin.getVersionNo(), e);
                    step.setStatus("FAILED");
                    step.setMessage(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
                    run.setStatus("FAILED");
                    run.setMessage("步骤 " + (i + 1) + "（" + origin.getDatasetName() + "/" + origin.getVersionNo() + "）执行失败: "
                            + step.getMessage() + "；已完成的新版本保留");
                    persistRun(run, steps);
                    return;
                }
                persistRun(run, steps);
            }
            run.setStatus("SUCCESS");
            run.setMessage("路径重跑完成，已生成 " + path.size() + " 个新版本");
            persistRun(run, steps);
        } catch (Exception e) {
            log.error("血缘路径重跑 run={} 编排异常", run.getId(), e);
            run.setStatus("FAILED");
            run.setMessage("编排异常: " + e.getMessage());
            persistRun(run, steps);
        }
    }

    /** 重跑单个节点：按产出方式分派，返回登记后的新版本 */
    private DatasetVersionEntity executeStep(DatasetVersionEntity origin, boolean isStart,
                                             Map<Long, List<String>> stepEdits,
                                             Map<Long, Long> idMap,
                                             Map<String, String> pathReplacements) throws Exception {
        ProvenanceType type = provenanceOf(origin);
        JSONObject cfg = parseConfig(origin.getDerivationConfig());

        DatasetCreateRequest request = new DatasetCreateRequest();
        request.setDatasetName(origin.getDatasetName());
        request.setProvenanceType(type.name());
        request.setDescription(origin.getDescription());
        request.setDataModality(origin.getDataModality());
        request.setProject(origin.getProject());
        request.setTags(origin.getTags());
        request.setRemark((StringUtils.hasText(origin.getRemark()) ? origin.getRemark() + "；" : "")
                + "路径重跑（源版本 " + origin.getVersionNo() + "）");
        // 版本号提前规划并查重，避免同名数据集同秒冲突导致存储路径/版本ID碰撞
        request.setVersionNo(nextAvailableVersionNo(origin.getDatasetName()));

        // 上游重映射：起始节点一律登记为独立根（无上游，执行仍读原输入数据）；
        // 中间节点把路径上的旧上游替换为新版本，路径外的辅助引用保持原版本
        List<Long> remappedUpstreams = new ArrayList<>();
        if (!isStart) {
            for (Long uid : datasetVersionService.parseUpstreamIds(origin)) {
                remappedUpstreams.add(idMap.getOrDefault(uid, uid));
            }
        }

        if (type == ProvenanceType.SOURCE) {
            // 新挂载一个版本：同源路径重新登记，不复制数据；作为下游节点时保留重映射的上游链位
            request.setSourcePath(origin.getStoragePath());
            if (!isStart) {
                request.setUpstreamVersionIds(remappedUpstreams);
            }
            return datasetCreationService.create(request);
        }

        if (type == ProvenanceType.IMPORT) {
            // 导入数据无法重传文件：用 SELECT * 从原存储路径读取物化；起始为独立根，下游保留重映射链位
            List<String> sqlList = new ArrayList<>();
            sqlList.add("select * from " + origin.getStoragePath());
            List<String> edited = stepEdits != null ? stepEdits.get(versionKey(origin)) : null;
            if (edited != null && !edited.isEmpty()) {
                sqlList = new ArrayList<>(edited);
            }
            sqlList = normalizeSqlStatements(sqlList);
            request.setProvenanceType(ProvenanceType.SQL_QUERY.name());
            if (isStart) {
                request.setExplicitRoot(true);
                request.setUpstreamVersionIds(new ArrayList<>());
            } else {
                request.setUpstreamVersionIds(remappedUpstreams);
            }
            request.setRemark(request.getRemark() + "（导入数据经 SELECT * 转化）");
            SqlSnippetEntity snippet = cloneSqlSnippet(origin, cfg, sqlList);
            request.setSqlSnippetId(snippet.getId());
            return datasetCreationService.create(request);
        }

        if (type == ProvenanceType.SQL_QUERY) {
            List<String> sqlList = extractSqlList(cfg);
            List<String> edited = stepEdits != null ? stepEdits.get(versionKey(origin)) : null;
            if (edited != null && !edited.isEmpty()) {
                sqlList = new ArrayList<>(edited);
            }
            sqlList = normalizeSqlStatements(sqlList);
            if (isStart) {
                // 起始 SQL 节点：新版本为无父级的独立根；执行仍读原上游数据（含字面路径，不做替换）
                request.setExplicitRoot(true);
                List<Long> originUpstreams = datasetVersionService.parseUpstreamIds(origin);
                request.setUpstreamVersionIds(new ArrayList<>());
                request.setExecutionUpstreamVersionIds(originUpstreams);
            } else {
                // 中间 SQL 节点：表名替换为新版本存储路径后克隆新脚本执行
                sqlList = replaceStoragePaths(sqlList, pathReplacements);
                request.setUpstreamVersionIds(remappedUpstreams);
            }
            SqlSnippetEntity snippet = cloneSqlSnippet(origin, cfg, sqlList);
            request.setSqlSnippetId(snippet.getId());
            Object udf = cfg.get("udfNames");
            if (udf instanceof List && !((List<?>) udf).isEmpty()) {
                request.setUdfNames(((List<?>) udf).stream().map(String::valueOf).collect(Collectors.toList()));
            }
            Map<String, List<Integer>> bindings = remapSqlBindings(cfg.get("upstreamSqlBindings"), idMap);
            if (bindings != null) {
                request.setUpstreamSqlBindings(bindings);
            }
            return datasetCreationService.create(request);
        }

        if (type == ProvenanceType.TRANSFORM) {
            // 克隆 Transform 编排：任务 SQL 引用克隆片段、导出文件换新名、清空调度，提交后等待作业完成
            TransformCompareEntity compare = cloneTransformCompare(origin, cfg, pathReplacements, idMap);
            request.setTransformCompareCreateTime(compare.getCreateTime());
            if (isStart) {
                // 起始 Transform 节点：无父级独立根，任务 SQL 按原输入路径原样重跑
                request.setExplicitRoot(true);
                request.setUpstreamVersionIds(new ArrayList<>());
            } else {
                request.setUpstreamVersionIds(remappedUpstreams);
            }
            DatasetVersionEntity created = datasetCreationService.create(request);
            waitForTransformJob(created);
            return created;
        }

        throw new IllegalArgumentException("该节点类型不支持重跑: " + type.getLabel());
    }

    /** 克隆 SQL 脚本为新记录（_fork 后缀），重跑版本的可回溯配方全部指向新脚本 */
    private SqlSnippetEntity cloneSqlSnippet(DatasetVersionEntity origin, JSONObject cfg, List<String> sqlList) {
        String originName = origin.getDatasetName();
        JSONObject snapshot = cfg.getJSONObject("sqlSnippet");
        if (snapshot != null && StringUtils.hasText(snapshot.getString("name"))) {
            originName = snapshot.getString("name");
        }
        SqlSnippetRequest save = new SqlSnippetRequest();
        save.setName(originName + "_fork_" + System.currentTimeMillis() + "_" + FORK_NAME_SEQ.incrementAndGet());
        save.setSqlList(sqlList);
        save.setDescription("血缘路径重跑生成：源脚本 " + originName + "（数据集 " + origin.getDatasetName() + "/" + origin.getVersionNo() + "）");
        return sqlSnippetService.saveSnippet(save);
    }

    /** 克隆 Transform 编排为新记录：任务 SQL 换克隆片段、导出文件换新名防覆盖、清空调度防周期执行 */
    private TransformCompareEntity cloneTransformCompare(DatasetVersionEntity origin, JSONObject cfg,
                                                         Map<String, String> pathReplacements,
                                                         Map<Long, Long> idMap) {
        JSONObject snapshot = cfg.getJSONObject("transformCompare");
        if (snapshot == null) {
            throw new IllegalArgumentException("版本缺少 Transform 编排快照，无法重跑");
        }

        TransformJobRequest save = new TransformJobRequest();
        save.setName(StringUtils.hasText(snapshot.getString("name"))
                ? snapshot.getString("name") + "_fork_" + System.currentTimeMillis()
                : origin.getDatasetName() + "_fork_" + System.currentTimeMillis());
        save.setOwner(AuthUtil.getCurrentUsername());
        // 重跑为一次性执行，清空调度策略避免周期任务反复触发
        save.setSchedule(null);

        Integer exportType = snapshot.getInteger("exportType");
        save.setExportType(exportType);
        String exportFile = snapshot.getString("exportFile");
        if (exportType != null && exportType == 1 && StringUtils.hasText(exportFile)) {
            save.setExportFile(renameExportFile(exportFile));
        } else {
            save.setExportFile(exportFile);
        }

        String taskListJson = snapshot.getString("taskList");
        List<TaskInfoDto> tasks = StringUtils.hasText(taskListJson)
                ? JSONArray.parseArray(taskListJson, TaskInfoDto.class) : new ArrayList<>();
        for (TaskInfoDto task : tasks) {
            if (task.getSqlSnippetId() != null) {
                SqlSnippetEntity snippet = sqlSnippetService.queryById(task.getSqlSnippetId());
                if (snippet == null) {
                    throw new IllegalArgumentException("无法读取 Transform 任务引用的 SQL 脚本 #" + task.getSqlSnippetId() + "（不存在或无权限）");
                }
                List<String> sqlList = JSONArray.parseArray(snippet.getSqlList(), String.class);
                sqlList = replaceStoragePaths(sqlList, pathReplacements);
                sqlList = normalizeSqlStatements(sqlList);
                SqlSnippetEntity cloned = cloneSqlSnippet(origin, new JSONObject(), sqlList);
                task.setSqlSnippetId(cloned.getId());
                task.setSqlSnippetName(cloned.getName());
            } else if (StringUtils.hasText(task.getDataset())) {
                log.warn("血缘路径重跑: 任务引用旧版 dataset 字段（{}），无法做表名替换，按原样提交", task.getDataset());
            }
        }
        save.setTaskList(tasks);

        try {
            return transformCompareService.saveTransform(save);
        } catch (Exception e) {
            throw new IllegalStateException("保存克隆 Transform 编排失败: " + e.getMessage(), e);
        }
    }

    /** 提交后的 Transform 作业轮询至终态；失败/超时抛出，终止后续步骤 */
    private void waitForTransformJob(DatasetVersionEntity version) throws Exception {
        String jobId = extractTransformJobId(version);
        if (jobId == null) {
            log.warn("血缘路径重跑: 版本 {} 缺少 Transform 作业ID，跳过等待（由状态刷新机制兜底）", versionKey(version));
            return;
        }
        long deadline = System.currentTimeMillis() + TRANSFORM_TIMEOUT_MS;
        Integer state = null;
        while (System.currentTimeMillis() < deadline) {
            TransformJobEntity job = transformJobService.statusJob(jobId);
            state = job != null ? job.getJobState() : null;
            if (isFinalJobState(state)) {
                break;
            }
            Thread.sleep(TRANSFORM_POLL_INTERVAL_MS);
        }
        if (!isFinalJobState(state)) {
            throw new IllegalStateException("Transform 作业等待超时（15 分钟），jobId=" + jobId);
        }
        if (state != 1) {
            throw new IllegalStateException("Transform 作业未成功完成，状态: " + jobStateLabel(state));
        }
        // 回写新版本的作业状态，避免图谱上一直显示"任务未知"
        version.setJobState(state);
        version.setId(version.getCreateTime());
        iginxClient.getWriteClient().writeMeasurement(version);
    }

    private String extractTransformJobId(DatasetVersionEntity version) {
        JSONObject cfg = parseConfig(version.getDerivationConfig());
        JSONObject job = cfg.getJSONObject("transformJob");
        return job != null ? job.getString("jobId") : null;
    }

    // ====================================================================
    // 文本替换与配置解析工具
    // ====================================================================

    /** 将 SQL 文本中的旧存储路径（表名）替换为新版本路径；按长度倒序替换并校验词边界，避免 v_1 误匹配 v_11 */
    private List<String> replaceStoragePaths(List<String> sqlList, Map<String, String> pathReplacements) {
        if (CollectionUtils.isEmpty(sqlList) || pathReplacements.isEmpty()) {
            return sqlList;
        }
        List<Map.Entry<String, String>> ordered = pathReplacements.entrySet().stream()
                .sorted((a, b) -> b.getKey().length() - a.getKey().length())
                .collect(Collectors.toList());
        List<String> result = new ArrayList<>();
        for (String sql : sqlList) {
            if (sql == null) {
                result.add(null);
                continue;
            }
            for (Map.Entry<String, String> entry : ordered) {
                sql = replacePathToken(sql, entry.getKey(), entry.getValue());
            }
            result.add(sql);
        }
        return result;
    }

    private String replacePathToken(String text, String oldPath, String newPath) {
        if (!StringUtils.hasText(text) || !text.contains(oldPath)) {
            return text;
        }
        StringBuffer sb = new StringBuffer();
        Pattern p = Pattern.compile(Pattern.quote(oldPath) + "(?![A-Za-z0-9_\\\\])");
        Matcher m = p.matcher(text);
        while (m.find()) {
            m.appendReplacement(sb, Matcher.quoteReplacement(newPath));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    /** 重映射 upstreamSqlBindings 的 key（旧上游版本ID -> 新版本ID） */
    @SuppressWarnings("unchecked")
    private Map<String, List<Integer>> remapSqlBindings(Object raw, Map<Long, Long> idMap) {
        if (!(raw instanceof Map) || ((Map<Object, Object>) raw).isEmpty()) {
            return null;
        }
        Map<String, List<Integer>> remapped = new LinkedHashMap<>();
        for (Map.Entry<String, List<Integer>> entry : ((Map<String, List<Integer>>) raw).entrySet()) {
            String key = entry.getKey();
            try {
                Long oldId = Long.valueOf(key);
                Long newId = idMap.get(oldId);
                key = newId != null ? String.valueOf(newId) : key;
            } catch (NumberFormatException ignore) {
                // 非数字 key 原样保留
            }
            remapped.put(key, entry.getValue());
        }
        return remapped;
    }

    /** 从 derivationConfig 快照提取 SQL 语句列表（快照中的 sqlList 为 JSON 字符串） */
    private List<String> extractSqlList(JSONObject cfg) {
        JSONObject snapshot = cfg.getJSONObject("sqlSnippet");
        String sqlListJson = snapshot != null ? snapshot.getString("sqlList") : null;
        List<String> sqlList = StringUtils.hasText(sqlListJson)
                ? JSONArray.parseArray(sqlListJson, String.class) : null;
        if (CollectionUtils.isEmpty(sqlList)) {
            throw new IllegalArgumentException("版本缺少 SQL 脚本快照，无法重跑");
        }
        return sqlList;
    }

    /** 规整 SQL 语句：去空白、去空行；确保以分号结尾（IginX 解析器要求语句以分号收尾） */
    private List<String> normalizeSqlStatements(List<String> sqlList) {
        if (CollectionUtils.isEmpty(sqlList)) {
            return sqlList;
        }
        List<String> normalized = new ArrayList<>();
        for (String sql : sqlList) {
            if (sql == null) {
                continue;
            }
            String t = sql.trim();
            if (t.isEmpty()) {
                continue;
            }
            if (!t.endsWith(";")) {
                t = t + ";";
            }
            normalized.add(t);
        }
        return normalized;
    }

    /** 导出文件换新名：base_fork_<ts>.ext，避免重跑覆盖旧版本作业的输出文件 */
    private String renameExportFile(String exportFile) {
        String normalized = exportFile.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        int dot = normalized.lastIndexOf('.');
        String base = dot > slash ? normalized.substring(0, dot) : normalized;
        String ext = dot > slash ? normalized.substring(dot) : "";
        return base + "_fork_" + System.currentTimeMillis() + ext;
    }

    /** 生成未占用的版本号（秒级时间戳），避免同名数据集同秒冲突导致存储路径碰撞 */
    private String nextAvailableVersionNo(String datasetName) throws InterruptedException {
        while (true) {
            String candidate = CommonUtil.generateVersion(System.currentTimeMillis());
            if (datasetVersionService.queryVersionByNameAndNo(datasetName, candidate) == null) {
                return candidate;
            }
            Thread.sleep(1000);
        }
    }

    // ====================================================================
    // 运行记录存取
    // ====================================================================

    private void persistRun(LineageForkRunEntity run, List<LineageForkRunDTO.Step> steps) {
        run.setStepsJson(JSONObject.toJSONString(steps));
        writeRun(run);
    }

    private void writeRun(LineageForkRunEntity run) {
        run.setId(run.getCreateTime());
        iginxClient.getWriteClient().writeMeasurement(run);
    }

    /** 查询重跑运行状态：仅发起人或管理员可见 */
    public LineageForkRunDTO getRun(Long runId) {
        LineageForkRunEntity run = queryRun(runId);
        if (run == null) {
            return null;
        }
        if (!AuthUtil.isAdmin()) {
            String user = AuthUtil.getCurrentUsername();
            if (user == null || !user.equals(run.getOperator())) {
                return null;
            }
        }
        return toDTO(run);
    }

    private LineageForkRunEntity queryRun(Long runId) {
        try {
            String sql = String.format("select * from %s where createTime = %d;", RUN_PREFIX, runId);
            List<Map<String, Object>> records = ConvertUtil.getRecords(iginxSession.executeSql(sql));
            if (records.isEmpty()) {
                return null;
            }
            LineageForkRunEntity entity = new LineageForkRunEntity();
            records.get(0).forEach((k, v) -> {
                String fieldName = k.replace(RUN_PREFIX + ".", "");
                ConvertUtil.setEntityField(entity, RUN_PREFIX, fieldName, v);
            });
            if (entity.getId() == null) {
                entity.setId(entity.getCreateTime());
            }
            return entity;
        } catch (Exception e) {
            log.error("查询血缘重跑记录失败, runId={}", runId, e);
            return null;
        }
    }

    private LineageForkRunDTO toDTO(LineageForkRunEntity run) {
        LineageForkRunDTO dto = new LineageForkRunDTO();
        dto.setRunId(run.getCreateTime() != null ? run.getCreateTime() : run.getId());
        dto.setStatus(run.getStatus());
        dto.setOperator(run.getOperator());
        dto.setTotalSteps(run.getTotalSteps());
        dto.setCurrentStepIndex(run.getCurrentStepIndex());
        dto.setMessage(run.getMessage());
        try {
            if (StringUtils.hasText(run.getStepsJson())) {
                dto.setSteps(JSONArray.parseArray(run.getStepsJson(), LineageForkRunDTO.Step.class));
            }
        } catch (Exception e) {
            log.warn("解析重跑步骤JSON失败: {}", e.getMessage());
        }
        return dto;
    }

    // ====================================================================
    // 通用小工具
    // ====================================================================

    private static boolean isFinalJobState(Integer jobState) {
        if (jobState == null || jobState < 0) {
            return false;
        }
        return jobState == 1 || jobState == 6 || jobState == 8 || jobState == 10;
    }

    private static String jobStateLabel(Integer state) {
        switch (state == null ? -1 : state) {
            case 1: return "任务完成";
            case 6: return "任务部分失败";
            case 8: return "任务失败";
            case 10: return "任务已取消";
            default: return "未知状态(" + state + ")";
        }
    }

    private static Long versionKey(DatasetVersionEntity v) {
        return v.getId() != null ? v.getId() : v.getCreateTime();
    }

    /** 与 LineageService 相同的快照解析：修复 fastjson2 数字 key 后解析 */
    private static JSONObject parseConfig(String json) {
        if (json == null || json.isEmpty()) {
            return new JSONObject();
        }
        try {
            return JSONObject.parseObject(fixNumericKeysInJson(json));
        } catch (Exception e) {
            log.warn("解析 derivationConfig 失败: {}", e.getMessage());
            return new JSONObject();
        }
    }

    /** 修复 JSON 中未加引号的数字 key：{123: "x"} → {"123": "x"}（历史数据兼容，不误改字符串内容里的数字） */
    private static String fixNumericKeysInJson(String json) {
        return json.replaceAll("(?<=\\{)(\\d+)(?=\\s*:)", "\"$1\"")
                   .replaceAll("(?<=,)(\\d+)(?=\\s*:)", "\"$1\"");
    }
}
