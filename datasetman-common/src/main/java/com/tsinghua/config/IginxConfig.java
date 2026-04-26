package com.tsinghua.config;

import cn.edu.tsinghua.iginx.exception.SessionException;
import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.IginXClientFactory;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * IGinX配置类 - 统一Session管理版本
 * 通过AOP切面统一管理Session的打开和关闭，业务代码无需手动管理
 */
@Slf4j
@Configuration
@EnableAspectJAutoProxy
@Aspect
public class IginxConfig {

    @Value("${iginx.ip}")
    private String ip;

    @Value("${iginx.port}")
    private int port;

    @Value("${iginx.username}")
    private String username;

    @Value("${iginx.password}")
    private String password;

    @Value("${iginx.timeout}")
    private long timeout;

    // IGinX操作的全局锁
    private final ReentrantLock iginxLock = new ReentrantLock();
    
    // Session状态管理
    private static final ThreadLocal<Session> sessionHolder = new ThreadLocal<>();
    private static final ThreadLocal<Boolean> sessionOpen = new ThreadLocal<Boolean>() {
        @Override
        protected Boolean initialValue() {
            return false;
        }
    };

    @Bean
    public IginXClient iginxClient() {
        return IginXClientFactory.create(ip, port, username, password);
    }

    @Bean
    public Session iginxSession() {
        // 创建Session代理，自动管理生命周期
        Session originalSession = new Session(ip, port, username, password);
        return new SessionProxy(originalSession);
    }

    /**
     * Session代理类 - 自动管理open/close
     */
    public static class SessionProxy extends Session {
        private final Session delegate;

        public SessionProxy(Session delegate) {
            super(delegate.getHost(), delegate.getPort(), delegate.getUsername(), delegate.getPassword());
            this.delegate = delegate;
            sessionHolder.set(this);
        }

        @Override
        public void openSession() throws SessionException {
            if (sessionOpen.get()) {
                log.warn("⚠️ Session已经打开，跳过重复打开");
                return;
            }
            
            log.info("🔓 自动打开Session");
            delegate.openSession();
            sessionOpen.set(true);
        }

        @Override
        public void closeSession() throws SessionException {
            if (!sessionOpen.get()) {
                log.warn("⚠️ Session未打开，跳过关闭");
                return;
            }
            
            log.info("🔒 自动关闭Session");
            delegate.closeSession();
            sessionOpen.set(false);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult executeSql(String sql) throws SessionException {
            ensureSessionOpen();
            return delegate.executeSql(sql);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.QueryDataSet executeQuery(String statement) throws SessionException {
            ensureSessionOpen();
            return delegate.executeQuery(statement);
        }

        @Override
        public java.util.List<cn.edu.tsinghua.iginx.session.Column> showColumns() throws SessionException {
            ensureSessionOpen();
            return delegate.showColumns();
        }

        @Override
        public cn.edu.tsinghua.iginx.session.ClusterInfo getClusterInfo() throws SessionException {
            ensureSessionOpen();
            return delegate.getClusterInfo();
        }

        @Override
        public void addStorageEngine(String ip, int port, cn.edu.tsinghua.iginx.thrift.StorageEngineType type, java.util.Map<String, String> extraParams) throws SessionException {
            ensureSessionOpen();
            delegate.addStorageEngine(ip, port, type, extraParams);
        }

        @Override
        public void removeStorageEngine(java.util.List<cn.edu.tsinghua.iginx.thrift.RemovedStorageEngineInfo> removedStorageEngineList) throws SessionException {
            ensureSessionOpen();
            delegate.removeStorageEngine(removedStorageEngineList);
        }

        @Override
        public cn.edu.tsinghua.iginx.utils.Pair<java.util.List<String>, Long> executeLoadCSV(String sql, String uploadedFileName) throws SessionException {
            ensureSessionOpen();
            return delegate.executeLoadCSV(sql, uploadedFileName);
        }

        @Override
        public void uploadFileChunk(cn.edu.tsinghua.iginx.thrift.FileChunk chunk) throws SessionException {
            ensureSessionOpen();
            delegate.uploadFileChunk(chunk);
        }

        @Override
        public long commitTransformJob(java.util.List<cn.edu.tsinghua.iginx.thrift.TaskInfo> taskInfoList, cn.edu.tsinghua.iginx.thrift.ExportType exportType, String filePath) throws SessionException {
            ensureSessionOpen();
            return delegate.commitTransformJob(taskInfoList, exportType, filePath);
        }

        @Override
        public long commitTransformJob(java.util.List<cn.edu.tsinghua.iginx.thrift.TaskInfo> taskInfoList, cn.edu.tsinghua.iginx.thrift.ExportType exportType, String fileName, String schedule) throws SessionException {
            ensureSessionOpen();
            return delegate.commitTransformJob(taskInfoList, exportType, fileName, schedule);
        }

        @Override
        public long commitTransformJob(java.util.List<cn.edu.tsinghua.iginx.thrift.TaskInfo> taskInfoList, cn.edu.tsinghua.iginx.thrift.ExportType exportType, String fileName, String schedule, boolean stopOnFailure) throws SessionException {
            ensureSessionOpen();
            return delegate.commitTransformJob(taskInfoList, exportType, fileName, schedule, stopOnFailure);
        }

        @Override
        public long commitTransformJob(String statement) throws SessionException {
            ensureSessionOpen();
            return delegate.commitTransformJob(statement);
        }

        @Override
        public long commitTransformJobByYaml(String filepath) throws SessionException {
            ensureSessionOpen();
            return delegate.commitTransformJobByYaml(filepath);
        }

        @Override
        public cn.edu.tsinghua.iginx.thrift.JobState queryTransformJobStatus(long jobId) throws SessionException {
            ensureSessionOpen();
            return delegate.queryTransformJobStatus(jobId);
        }

        @Override
        public java.util.Map<cn.edu.tsinghua.iginx.thrift.JobState, java.util.List<Long>> showEligibleJob(cn.edu.tsinghua.iginx.thrift.JobState jobState) throws SessionException {
            ensureSessionOpen();
            return delegate.showEligibleJob(jobState);
        }

        @Override
        public void cancelTransformJob(long jobId) throws SessionException {
            ensureSessionOpen();
            delegate.cancelTransformJob(jobId);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.QueryDataSet executeQuery(String statement, int fetchSize) throws SessionException {
            ensureSessionOpen();
            return delegate.executeQuery(statement, fetchSize);
        }

        @Override
        public void addStorageEngines(java.util.List<cn.edu.tsinghua.iginx.thrift.StorageEngine> storageEngines) throws SessionException {
            ensureSessionOpen();
            delegate.addStorageEngines(storageEngines);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.CurveMatchResult curveMatch(java.util.List<String> paths, long startKey, long endKey, java.util.List<Double> curveQuery, long curveUnit) throws SessionException {
            ensureSessionOpen();
            return delegate.curveMatch(paths, startKey, endKey, curveQuery, curveUnit);
        }

        @Override
        public cn.edu.tsinghua.iginx.thrift.LoadUDFResp executeRegisterTask(String statement) throws SessionException {
            ensureSessionOpen();
            return delegate.executeRegisterTask(statement);
        }

        @Override
        public cn.edu.tsinghua.iginx.thrift.LoadUDFResp executeRegisterTask(String statement, boolean isRemote) throws SessionException {
            ensureSessionOpen();
            return delegate.executeRegisterTask(statement, isRemote);
        }

        @Override
        public int getReplicaNum() throws SessionException {
            ensureSessionOpen();
            return delegate.getReplicaNum();
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet queryLast(java.util.List<String> paths, long startKey, cn.edu.tsinghua.iginx.thrift.TimePrecision timePrecision) throws SessionException {
            ensureSessionOpen();
            return delegate.queryLast(paths, startKey, timePrecision);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet queryLast(java.util.List<String> paths, long startKey) throws SessionException {
            ensureSessionOpen();
            return delegate.queryLast(paths, startKey);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet queryLast(java.util.List<String> paths, long startKey, java.util.List<java.util.Map<String, java.util.List<String>>> tagsList) throws SessionException {
            ensureSessionOpen();
            return delegate.queryLast(paths, startKey, tagsList);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet queryLast(java.util.List<String> paths, long startKey, java.util.List<java.util.Map<String, java.util.List<String>>> tagsList, cn.edu.tsinghua.iginx.thrift.TimePrecision timePrecision) throws SessionException {
            ensureSessionOpen();
            return delegate.queryLast(paths, startKey, tagsList, timePrecision);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet queryData(java.util.List<String> paths, long startKey, long endKey) throws SessionException {
            ensureSessionOpen();
            return delegate.queryData(paths, startKey, endKey);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet queryData(java.util.List<String> paths, long startKey, long endKey, java.util.List<java.util.Map<String, java.util.List<String>>> tagsList) throws SessionException {
            ensureSessionOpen();
            return delegate.queryData(paths, startKey, endKey, tagsList);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet queryData(java.util.List<String> paths, long startKey, long endKey, java.util.List<java.util.Map<String, java.util.List<String>>> tagsList, cn.edu.tsinghua.iginx.thrift.TimePrecision timePrecision) throws SessionException {
            ensureSessionOpen();
            return delegate.queryData(paths, startKey, endKey, tagsList, timePrecision);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionAggregateQueryDataSet aggregateQuery(java.util.List<String> paths, long startKey, long endKey, cn.edu.tsinghua.iginx.thrift.AggregateType aggregateType) throws SessionException {
            ensureSessionOpen();
            return delegate.aggregateQuery(paths, startKey, endKey, aggregateType);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionAggregateQueryDataSet aggregateQuery(java.util.List<String> paths, long startKey, long endKey, cn.edu.tsinghua.iginx.thrift.AggregateType aggregateType, cn.edu.tsinghua.iginx.thrift.TimePrecision timePrecision) throws SessionException {
            ensureSessionOpen();
            return delegate.aggregateQuery(paths, startKey, endKey, aggregateType, timePrecision);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionAggregateQueryDataSet aggregateQuery(java.util.List<String> paths, long startKey, long endKey, cn.edu.tsinghua.iginx.thrift.AggregateType aggregateType, java.util.List<java.util.Map<String, java.util.List<String>>> tagsList) throws SessionException {
            ensureSessionOpen();
            return delegate.aggregateQuery(paths, startKey, endKey, aggregateType, tagsList);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionAggregateQueryDataSet aggregateQuery(java.util.List<String> paths, long startKey, long endKey, cn.edu.tsinghua.iginx.thrift.AggregateType aggregateType, java.util.List<java.util.Map<String, java.util.List<String>>> tagsList, cn.edu.tsinghua.iginx.thrift.TimePrecision timePrecision) throws SessionException {
            ensureSessionOpen();
            return delegate.aggregateQuery(paths, startKey, endKey, aggregateType, tagsList, timePrecision);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet downsampleQuery(java.util.List<String> paths, long startKey, long endKey, cn.edu.tsinghua.iginx.thrift.AggregateType aggregateType, long precision, cn.edu.tsinghua.iginx.thrift.TimePrecision timePrecision) throws SessionException {
            ensureSessionOpen();
            return delegate.downsampleQuery(paths, startKey, endKey, aggregateType, precision, timePrecision);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet downsampleQuery(java.util.List<String> paths, long startKey, long endKey, cn.edu.tsinghua.iginx.thrift.AggregateType aggregateType, long precision) throws SessionException {
            ensureSessionOpen();
            return delegate.downsampleQuery(paths, startKey, endKey, aggregateType, precision);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet downsampleQuery(java.util.List<String> paths, long startKey, long endKey, cn.edu.tsinghua.iginx.thrift.AggregateType aggregateType, long precision, java.util.List<java.util.Map<String, java.util.List<String>>> tagsList) throws SessionException {
            ensureSessionOpen();
            return delegate.downsampleQuery(paths, startKey, endKey, aggregateType, precision, tagsList);
        }

        @Override
        public cn.edu.tsinghua.iginx.session.SessionQueryDataSet downsampleQuery(java.util.List<String> paths, long startKey, long endKey, cn.edu.tsinghua.iginx.thrift.AggregateType aggregateType, long precision, java.util.List<java.util.Map<String, java.util.List<String>>> tagsList, cn.edu.tsinghua.iginx.thrift.TimePrecision timePrecision) throws SessionException {
            ensureSessionOpen();
            return delegate.downsampleQuery(paths, startKey, endKey, aggregateType, precision, tagsList, timePrecision);
        }

        @Override
        public void addUser(String username, String password, java.util.Set<cn.edu.tsinghua.iginx.thrift.AuthType> auths) throws SessionException {
            ensureSessionOpen();
            delegate.addUser(username, password, auths);
        }

        @Override
        public void updateUser(String username, String password, java.util.Set<cn.edu.tsinghua.iginx.thrift.AuthType> auths) throws SessionException {
            ensureSessionOpen();
            delegate.updateUser(username, password, auths);
        }

        @Override
        public void deleteUser(String username) throws SessionException {
            ensureSessionOpen();
            delegate.deleteUser(username);
        }

        @Override
        public void deleteColumn(String path) throws SessionException {
            ensureSessionOpen();
            delegate.deleteColumn(path);
        }

        @Override
        public void deleteColumns(java.util.List<String> paths) throws SessionException {
            ensureSessionOpen();
            delegate.deleteColumns(paths);
        }

        @Override
        public void deleteColumns(java.util.List<String> paths, java.util.List<java.util.Map<String, java.util.List<String>>> tags, cn.edu.tsinghua.iginx.thrift.TagFilterType type) throws SessionException {
            ensureSessionOpen();
            delegate.deleteColumns(paths, tags, type);
        }

        @Override
        public void deleteDataInColumn(String path, long startKey, long endKey) throws SessionException {
            ensureSessionOpen();
            delegate.deleteDataInColumn(path, startKey, endKey);
        }

        @Override
        public void deleteDataInColumns(java.util.List<String> paths, long startKey, long endKey) throws SessionException {
            ensureSessionOpen();
            delegate.deleteDataInColumns(paths, startKey, endKey);
        }

        @Override
        public void deleteDataInColumns(java.util.List<String> paths, long startKey, long endKey, java.util.List<java.util.Map<String, java.util.List<String>>> tagsList, cn.edu.tsinghua.iginx.thrift.TagFilterType type) throws SessionException {
            ensureSessionOpen();
            delegate.deleteDataInColumns(paths, startKey, endKey, tagsList, type);
        }

        @Override
        public void insertColumnRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList) throws SessionException {
            ensureSessionOpen();
            delegate.insertColumnRecords(paths, keys, valuesList, dataTypeList);
        }

        @Override
        public void insertColumnRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList, java.util.List<java.util.Map<String, String>> tagsList) throws SessionException {
            ensureSessionOpen();
            delegate.insertColumnRecords(paths, keys, valuesList, dataTypeList, tagsList);
        }

        @Override
        public void insertColumnRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList, java.util.List<java.util.Map<String, String>> tagsList, cn.edu.tsinghua.iginx.thrift.TimePrecision precision) throws SessionException {
            ensureSessionOpen();
            delegate.insertColumnRecords(paths, keys, valuesList, dataTypeList, tagsList, precision);
        }

        @Override
        public void insertNonAlignedColumnRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList) throws SessionException {
            ensureSessionOpen();
            delegate.insertNonAlignedColumnRecords(paths, keys, valuesList, dataTypeList);
        }

        @Override
        public void insertNonAlignedColumnRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList, java.util.List<java.util.Map<String, String>> tagsList) throws SessionException {
            ensureSessionOpen();
            delegate.insertNonAlignedColumnRecords(paths, keys, valuesList, dataTypeList, tagsList);
        }

        @Override
        public void insertNonAlignedColumnRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList, java.util.List<java.util.Map<String, String>> tagsList, cn.edu.tsinghua.iginx.thrift.TimePrecision precision) throws SessionException {
            ensureSessionOpen();
            delegate.insertNonAlignedColumnRecords(paths, keys, valuesList, dataTypeList, tagsList, precision);
        }

        @Override
        public void insertRowRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList, java.util.List<java.util.Map<String, String>> tagsList) throws SessionException {
            ensureSessionOpen();
            delegate.insertRowRecords(paths, keys, valuesList, dataTypeList, tagsList);
        }

        @Override
        public void insertRowRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList, java.util.List<java.util.Map<String, String>> tagsList, cn.edu.tsinghua.iginx.thrift.TimePrecision precision) throws SessionException {
            ensureSessionOpen();
            delegate.insertRowRecords(paths, keys, valuesList, dataTypeList, tagsList, precision);
        }

        @Override
        public void insertNonAlignedRowRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList) throws SessionException {
            ensureSessionOpen();
            delegate.insertNonAlignedRowRecords(paths, keys, valuesList, dataTypeList);
        }

        @Override
        public void insertNonAlignedRowRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList, java.util.List<java.util.Map<String, String>> tagsList) throws SessionException {
            ensureSessionOpen();
            delegate.insertNonAlignedRowRecords(paths, keys, valuesList, dataTypeList, tagsList);
        }

        @Override
        public void insertNonAlignedRowRecords(java.util.List<String> paths, long[] keys, Object[] valuesList, java.util.List<cn.edu.tsinghua.iginx.thrift.DataType> dataTypeList, java.util.List<java.util.Map<String, String>> tagsList, cn.edu.tsinghua.iginx.thrift.TimePrecision precision) throws SessionException {
            ensureSessionOpen();
            delegate.insertNonAlignedRowRecords(paths, keys, valuesList, dataTypeList, tagsList, precision);
        }

        /**
         * 确保Session已打开
         */
        private void ensureSessionOpen() throws SessionException {
            if (!sessionOpen.get()) {
                log.info("🔓 检测到Session未打开，自动打开");
                delegate.openSession();
                sessionOpen.set(true);
            }
        }

        // 委托其他方法
        @Override
        public String getHost() {
            return delegate.getHost();
        }

        @Override
        public int getPort() {
            return delegate.getPort();
        }

        @Override
        public String getUsername() {
            return delegate.getUsername();
        }

        @Override
        public String getPassword() {
            return delegate.getPassword();
        }
    }

    /**
     * IGinX操作切面 - 并发控制和自动Session管理
     */
    @Around("execution(* cn.edu.tsinghua.iginx.session.Session.*(..))")
    public Object aroundSessionOperations(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        
        // openSession和closeSession由代理类内部管理，这里不拦截
        if ("openSession".equals(methodName) || "closeSession".equals(methodName)) {
            return joinPoint.proceed();
        }

        // 其他操作需要并发控制
        if (!iginxLock.tryLock(timeout, TimeUnit.MILLISECONDS)) {
            log.error("❌ IGinX操作超时，无法获取锁: {} (等待超时: {}ms)", methodName, timeout);
            throw new RuntimeException("IGinX操作繁忙，请稍后重试");
        }
        try {
            long startTime = System.currentTimeMillis();
            Object result = joinPoint.proceed();
            long endTime = System.currentTimeMillis();
            
            log.info("⏱️ IGinX操作完成: " + methodName +
                             " (耗时: " + (endTime - startTime) + "ms)");
            return result;
        } finally {
            iginxLock.unlock();
        }
    }

    /**
     * IginXClient操作切面 - 并发控制
     */
    @Around("execution(* cn.edu.tsinghua.iginx.session_v2.IginXClient.*(..))")
    public Object aroundClientOperations(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        
        if (!iginxLock.tryLock(timeout, TimeUnit.MILLISECONDS)) {
            log.error("❌ IginXClient操作超时，无法获取锁: {} (等待超时: {}ms)", methodName, timeout);
            throw new RuntimeException("IGinX操作繁忙，请稍后重试");
        }
        try {
            long startTime = System.currentTimeMillis();
            Object result = joinPoint.proceed();
            long endTime = System.currentTimeMillis();
            
            log.info("⏱️ IginXClient操作完成: " + methodName +
                             " (耗时: " + (endTime - startTime) + "ms)");
            return result;
        } finally {
            iginxLock.unlock();
        }
    }

    /**
     * 服务方法切面 - 自动Session生命周期管理
     * 拦截服务层方法，确保Session正确打开和关闭
     */
    @Around("execution(* com.tsinghua.service.*.*(..))")
    public Object aroundServiceMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        
        // 只处理包含IGinX操作的服务方法
//        if (!containsIginxOperation(methodName)) {
//            return joinPoint.proceed();
//        }

        log.info("🚀 开始执行服务方法: " + className + "." + methodName);
        
        try {
            // 方法执行前确保Session打开
            Session session = sessionHolder.get();
            if (session != null && !sessionOpen.get()) {
                session.openSession();
                sessionOpen.set(true);
            }
            
            Object result = joinPoint.proceed();
            
            log.info("✅ 服务方法执行完成: " + className + "." + methodName);
            return result;
            
        } catch (Exception e) {
            // 检查是否是响应流相关的异常，如果是则重新抛出避免重复处理
            if (e.getMessage() != null && e.getMessage().contains("getOutputStream() has already been called")) {
                log.error("⚠️ 响应流冲突异常: " + className + "." + methodName + " - " + e.getMessage());
                throw e;
            }
            
            log.error("❌ 服务方法执行异常: " + className + "." + methodName + " - " + e.getMessage(), e);
            throw e;
        } finally {
            // 方法执行后自动关闭Session
            Session session = sessionHolder.get();
            if (session != null && sessionOpen.get()) {
                try {
                    session.closeSession();
                    sessionOpen.set(false);
                    log.info("🔒 自动关闭Session");
                } catch (Exception e) {
                    log.error("⚠️ 关闭Session异常: " + e.getMessage(), e);
                }
            }
        }
    }

    /**
     * 判断方法是否包含IGinX操作
     */
    private boolean containsIginxOperation(String methodName) {
        return methodName.contains("DataSource") || 
               methodName.contains("Model") || 
               methodName.contains("Data") ||
               methodName.contains("query") ||
               methodName.contains("export") ||
               methodName.contains("import") ||
               methodName.contains("upload") ||
               methodName.contains("delete") ||
               methodName.contains("save") ||
               methodName.contains("register") ||
               methodName.contains("remove");
    }
}
