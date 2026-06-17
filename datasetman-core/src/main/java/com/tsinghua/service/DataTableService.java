package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.DeleteClient;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.QueryClient;
import cn.edu.tsinghua.iginx.session_v2.query.*;
import cn.edu.tsinghua.iginx.thrift.*;
import cn.edu.tsinghua.iginx.utils.Pair;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsinghua.auth.service.DataPermissionService;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.dto.*;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;


/**
 * 数据源管理服务
 */
@Slf4j
@Service
public class DataTableService {

    private static final int CHUNK_SIZE = 1024 * 1024; // 1MB，与源码一致

    private static final String KEY = "key";

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    @Autowired
    private DataPermissionService dataPermissionService;

    public TableDto queryData(DataQueryRequest request) {
        List<String> columns = new ArrayList<>();
        List<Map<String, Object>> resultSet = new ArrayList<>();

        try {
            IginXTable table = queryIginXTable(request);

            IginXHeader header = table.getHeader();
            if (header.hasTimestamp()) {
                log.info(KEY+"\t");
                columns.add(KEY);
            }
            for (IginXColumn column : header.getColumns()) {
                log.info(column.getName() + "\t");
                columns.add(column.getName());
            }

            List<IginXRecord> records = table.getRecords();
            for (IginXRecord record : records) {
                Map<String, Object> recordMap = new LinkedHashMap<>();
                if (header.hasTimestamp()) {
//                log.info(record.getKey() + "\t");
                    recordMap.put(KEY, record.getKey());
                }
//                recordMap.putAll(record.getValues());
                for (IginXColumn column: header.getColumns()) {
                    Object value = record.getValue(column.getName());
                    if (value instanceof byte[]) {
//                        // 根据列名判断是二进制数据还是文本数据
//                        if (ConvertUtil.isBinaryColumn(column.getName())) {
//                            // 二进制数据（如图片）使用Base64编码
//                            recordMap.put(column.getName(), ConvertUtil.bytesToBase64((byte[]) value));
//                        } else {
//                            // 文本数据使用UTF-8解码
//                            recordMap.put(column.getName(), ConvertUtil.bytesToString((byte[]) value));
//                        }
                        if (ConvertUtil.isValidUtf8((byte[]) value)) {
                            // 文本数据使用UTF-8解码
                            recordMap.put(column.getName(), ConvertUtil.bytesToString((byte[]) value));
                        } else {
                            // 二进制数据（如图片）使用Base64编码
                            recordMap.put(column.getName(), ConvertUtil.bytesToBase64((byte[]) value));
                        }
                    } else {
                        recordMap.put(column.getName(), value);
                    }
                }
                resultSet.add(recordMap);
            }
        } catch (Exception e) {
            log.error("数据查询失败", e);
        }

        return new TableDto(columns, resultSet);
    }

    public Long importData(MultipartFile file, DataImportRequest importConfig) throws Exception {
        Path tempFilePath = null;

        try {
            // iginxSession.openSession();
            String uploadedFileName = System.currentTimeMillis() + ".csv";
            // 1. 保存上传文件到临时位置
            tempFilePath = Files.createTempFile("iginx_upload_", ".csv");
            file.transferTo(tempFilePath.toFile());
            return importCsvFile(tempFilePath, importConfig.getTargetPath(), uploadedFileName, AuthUtil.getCurrentUsername());
        }  finally {
            // 清理临时文件
            if (tempFilePath != null) {
                Files.deleteIfExists(tempFilePath);
            }
            // iginxSession.closeSession();
        }
    }
    /**
     * 公用CSV导入方法
     * 分块上传CSV文件到IGinX并执行LOAD DATA
     *
     * @param csvFilePath CSV文件路径
     * @param targetPath 目标路径
     * @param uploadedFileName 上传后的文件名
     * @return 导入结果
     */
    public Long importCsvFile(Path csvFilePath, String targetPath, String uploadedFileName, String owner) throws Exception {

        // 1. 解析命令并获取服务端准备的状态/路径（如果需要）
        // 根据源码，此处可能会返回一个服务端期望的路径，但uploadFileChunk似乎更直接。
        // 实际流程可能需要先调用一个接口获取上传令牌或路径。这里假设直接上传。
        log.info("开始导入csv文件，csvFilePath：{}, targetPath:{}, uploadedFileName:{}", csvFilePath, targetPath, uploadedFileName);

        // 2. 构建LOAD DATA SQL语句
        // 注意：此处的路径是一个“约定”或“任务标识”，最终文件通过uploadFileChunk上传
        String sql = String.format("LOAD DATA FROM INFILE '%s' AS CSV INTO %s;",
                uploadedFileName, // 使用一个约定的文件名
                targetPath);

        // 3. 分块读取临时文件并上传
        try (RandomAccessFile raf = new RandomAccessFile(csvFilePath.toFile(), "r")) {
            long offset = 0;
            byte[] buffer = new byte[CHUNK_SIZE];
            int bytesRead;
            while ((bytesRead = raf.read(buffer)) != -1) {
                byte[] dataToSend;
                if (bytesRead < CHUNK_SIZE) {
                    dataToSend = new byte[bytesRead];
                    System.arraycopy(buffer, 0, dataToSend, 0, bytesRead);
                } else {
                    dataToSend = buffer;
                }
                ByteBuffer data = ByteBuffer.wrap(dataToSend);
                FileChunk chunk = new FileChunk(uploadedFileName, offset, data, bytesRead);
                iginxSession.uploadFileChunk(chunk); // 关键步骤：上传文件块
                offset += bytesRead;
            }
        }

        // 4. 所有块上传完成后，执行导入SQL
        Pair<List<String>, Long> result = iginxSession.executeLoadCSV(sql, uploadedFileName);
        dataPermissionService.saveTablePrefix(targetPath, false, owner);
        return result.v;
    }

    public void exportData(DataQueryRequest request, HttpServletResponse response) {
        OutputStream outputStream = null;
        OutputStreamWriter writer = null;
        try {
            IginXTable table = queryIginXTable(request);;
            String fileName = "export_" + System.currentTimeMillis() + ".csv";
            // 设置响应头
            response.setContentType("text/csv");
            response.setCharacterEncoding("UTF-8");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + fileName + "\"");
            
            outputStream = response.getOutputStream();
            writer = new OutputStreamWriter(outputStream, "UTF-8");

            // 直接一行一行写入表头和数据
            IginXHeader header = table.getHeader();
            if (header.hasTimestamp()) {
                writer.write("key,");
            }
            for (IginXColumn column: header.getColumns()) {
                writer.write(column.getName() + ",");
            }
            writer.write("\n");
            writer.flush();
            List<IginXRecord> records = table.getRecords();
            for (IginXRecord record: records) {
                if (header.hasTimestamp()) {
                    writer.write(record.getKey() + ",");
                }
                for (IginXColumn column: header.getColumns()) {
                    if (record.getValue(column.getName()) instanceof byte[]) {
                        writer.write(ConvertUtil.bytesToString((byte[]) record.getValue(column.getName())));
                    } else {
                        writer.write(String.valueOf(record.getValue(column.getName())));
                    }
                    writer.write(",");
                }
                writer.write("\n");
                writer.flush();
            }

        } catch (IOException e) {
            // 忽略客户端中断
            log.error("客户端中断", e);
        } catch (Exception e) {
            // 其他异常时，确保writer和outputStream已关闭
            if (writer != null) {
                try {
                    writer.close();
                } catch (Exception ex) {
                    log.error("关闭writer失败", ex);
                }
            }
            if (outputStream != null) {
                try {
                    outputStream.close();
                } catch (Exception ex) {
                    log.error("关闭outputStream失败", ex);
                }
            }
            log.error("导出数据失败", e);
            throw new RuntimeException("导出数据失败: " + e.getMessage(), e);
        }
    }

    public IginXTable queryIginXTable(DataQueryRequest request) {
        QueryClient queryClient = iginxClient.getQueryClient();

        Set<String> paths = new HashSet<>(request.getPaths());
        long startKey = Optional.ofNullable(request.getStartTime()).orElse(0L);
        long endKey = Optional.ofNullable(request.getEndTime()).orElse(Long.MAX_VALUE);

        long precision = request.getPrecision();
        if (precision <= 0L) {
            precision = 1000L;
        }
        TimePrecision timePrecision;
        if (request.getTimePrecision() == null || TimePrecision.findByValue(request.getTimePrecision()) == null) {
            timePrecision = TimePrecision.MS;
        } else {
            timePrecision = TimePrecision.findByValue(request.getTimePrecision());
        }

        IginXTable table;
        if (request.getAggregateType() == null || AggregateType.findByValue(request.getAggregateType()) == null) {
            table = queryClient.query(
                    SimpleQuery.builder()
                            .addMeasurements(paths)
                            .startKey(startKey)
                            .endKey(endKey)
                            .build()
            );
        } else {
            table = queryClient.query(DownsampleQuery.builder()
                    .addMeasurements(paths)
                    .startKey(startKey)
                    .endKey(endKey)
                    .aggregate(AggregateType.findByValue(request.getAggregateType()))
                    .precision(precision)
                    .timePrecision(timePrecision.name())
                    .build());
        }
        return table;
    }

    public void deleteData(DataQueryRequest request) {
        DeleteClient deleteClient = iginxClient.getDeleteClient();
        // 删除多个时间序列在 [startTime, endTime) 这段时间上的数据
        deleteClient.deleteMeasurementsData(request.getPaths(), request.getStartTime(), request.getEndTime());
    }

    public TimeRangeResponse getTimeRange(TimeRangeRequest request) throws Exception {
        TimeRangeResponse response = new TimeRangeResponse();
        String tableName = request.getTableName();
        List<String> fieldList = request.getInputsBind() == null ? Collections.emptyList() : request.getInputsBind().stream()
                .map(InputBindDto::getSourceField)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toList());
        String field = fieldList.isEmpty() ? "*" : String.join(",", fieldList);
        log.info("查询数据表时间范围,数据表: {},字段: {},", tableName, field);

        String minSql = "SELECT %s FROM %s limit 1;";
        SessionExecuteSqlResult minResult = iginxSession.executeSql(String.format(minSql, field, tableName));
        Long minKey = minResult.getKeys()[0];

        String maxSql = "SELECT %s FROM %s order by key desc limit 1;";
        SessionExecuteSqlResult maxResult = iginxSession.executeSql(String.format(maxSql, field, tableName));
        Long maxKey = maxResult.getKeys()[0];

        response.setMinKey(minKey);
        response.setMaxKey(maxKey);
        log.info("时间范围查询结果: minKey={}, maxKey={}", minKey, maxKey);
        return response;
    }

    /**
     * 流式查询数据，专门用于大文件查询
     * 使用Consumer查询IginX放入队列，从队列流式写入HTTP响应（二进制数据）
     */
    public void queryDataStreaming(DataQueryRequest request, HttpServletResponse response) {
        try {
            log.info("开始流式查询，路径: {}", request.getPaths());
            QueryClient queryClient = iginxClient.getQueryClient();

            Set<String> paths = new HashSet<>(request.getPaths());
            long startKey = 0L;
            long endKey = Long.MAX_VALUE;

            // 设置响应头为二进制流
            response.setStatus(HttpServletResponse.SC_OK);
            response.setContentType("application/octet-stream");
            response.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate");
            response.setHeader(HttpHeaders.PRAGMA, "no-cache");
            response.setHeader(HttpHeaders.EXPIRES, "0");

            OutputStream outputStream = response.getOutputStream();

            // 使用队列进行线程间通信
            final java.util.concurrent.BlockingQueue<byte[]> queue = new java.util.concurrent.LinkedBlockingQueue<>();
            final int[] recordCount = {0};
            final long[] totalBytes = {0};
            final java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);

            // 启动Consumer线程查询IginX并放入队列
            Thread consumerThread = new Thread(() -> {
                try {
                    queryClient.query(
                        SimpleQuery.builder()
                            .addMeasurements(paths)
                            .startKey(startKey)
                            .endKey(endKey)
                            .build(),
                        record -> {
                            for (IginXColumn column: record.getHeader().getColumns()) {
                                Object value = record.getValue(column.getName());
                                if (value instanceof byte[]) {
                                    byte[] bytes = (byte[]) value;
                                    try {
                                        queue.put(bytes);
                                        recordCount[0]++;
                                        totalBytes[0] += bytes.length;
                                    } catch (InterruptedException e) {
                                        log.error("放入队列失败", e);
                                    }
                                }
                            }
                        }
                    );
                } catch (Exception e) {
                    log.error("Consumer线程异常", e);
                } finally {
                    latch.countDown();
                }
            });

            consumerThread.start();

            // 主线程从队列取出数据流式写入HTTP响应
            try {
                final long[] writtenBytes = {0};
                
                byte[] data;
                while (true) {
                    data = queue.poll(1, java.util.concurrent.TimeUnit.SECONDS);
                    if (data == null) {
                        // 队列为空，检查Consumer是否完成
                        if (latch.await(100, java.util.concurrent.TimeUnit.MILLISECONDS)) {
                            // Consumer已完成，队列也为空，退出循环
                            break;
                        }
                        // Consumer未完成，继续等待
                        continue;
                    }
                    outputStream.write(data);
                    outputStream.flush();
                    writtenBytes[0] += data.length;
                }
                
                log.info("Consumer完成，放入队列记录数: {}, 总字节数: {}", recordCount[0], totalBytes[0]);
                log.info("流式查询完成，写入记录数: {}, 写入字节数: {}", recordCount[0], writtenBytes[0]);
            } catch (InterruptedException e) {
                log.error("从队列取数据被中断", e);
            }

        } catch (IOException e) {
            log.error("流式查询失败", e);
            throw new RuntimeException("流式查询失败: " + e.getMessage(), e);
        }
    }

}
