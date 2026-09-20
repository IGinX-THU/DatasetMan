package com.tsinghua.service;

import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.QueryClient;

import cn.edu.tsinghua.iginx.session_v2.query.*;
import cn.edu.tsinghua.iginx.thrift.TimePrecision;
import com.tsinghua.dto.RelationalQueryRequest;
import com.tsinghua.dto.TableDto;
import com.tsinghua.util.ConvertUtil;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.checkerframework.checker.nullness.compatqual.NonNullDecl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class RelationalDataService {

    @Autowired
    private Session iginxSession;

    @Autowired
    private IginXClient iginxClient;

    public TableDto queryData(RelationalQueryRequest request) {
        try {
            // 构建SQL查询语句
            String sql = buildQuerySql(request);

            // 修复分页计算：OFFSET应该是(pageNum - 1) * pageSize
            int offset = (request.getPageNum() - 1) * request.getPageSize();
            String finalSql = sql + String.format(" LIMIT %s OFFSET %s;", request.getPageSize(), offset);

            log.info("执行SQL: {}, tableName: {}, pageSize: {}, offset: {}",
                    finalSql, request.getTableName(), request.getPageSize(), offset);

            // iginxSession.openSession();
            SessionExecuteSqlResult res = iginxSession.executeSql(finalSql);
            // iginxSession.closeSession();

            TableDto result = convertTableDto(res);

            // SQL方式查询成功但查无数据时，使用Client方式再查一次兜底
            if (result.getRecords().isEmpty()) {
                log.info("SQL方式查询无数据，尝试使用Client方式再查一次, tableName: {}", request.getTableName());
                return queryDataByClient(request);
            }

            return result;
        } catch (Exception e) {
            log.warn("SQL方式查询失败，尝试使用Client方式查询: {}", e.getMessage());
            return queryDataByClient(request);
        }
    }

    /** 当SQL方式查询失败或查无数据时，使用Client方式作为fallback */
    private TableDto queryDataByClient(RelationalQueryRequest request) {
        try {
            // 将RelationalQueryRequest转换为DataQueryRequest格式
            // 从tableName构建列路径，获取该表下的所有列
            Set<String> paths = new HashSet<>();
            paths.add(request.getTableName() + ".*");

            // 默认时间范围与SQL方式的默认语义保持一致（startKey=0，endKey按毫秒精度取最大时间）
            long startKey = 0L;
            long endKey = calculateMaxTime(null);

            // 使用Client方式查询
            QueryClient queryClient = iginxClient.getQueryClient();
            IginXTable table = queryClient.query(
                    SimpleQuery.builder()
                            .addMeasurements(paths)
                            .startKey(startKey)
                            .endKey(endKey)
                            .build()
            );

            // 转换为TableDto
            List<String> columns = new ArrayList<>();
            List<Map<String, Object>> records = new ArrayList<>();

            IginXHeader header = table.getHeader();
            if (header.hasTimestamp()) {
                columns.add("key");
            }
            for (IginXColumn column : header.getColumns()) {
                columns.add(column.getName());
            }

            List<IginXRecord> iginxRecords = table.getRecords();
            for (IginXRecord record : iginxRecords) {
                Map<String, Object> recordMap = new LinkedHashMap<>();
                if (header.hasTimestamp()) {
                    recordMap.put("key", record.getKey());
                }
                for (IginXColumn column : header.getColumns()) {
                    Object value = record.getValue(column.getName());
                    if (value instanceof byte[]) {
                        if (ConvertUtil.isValidUtf8((byte[]) value)) {
                            recordMap.put(column.getName(), ConvertUtil.bytesToString((byte[]) value));
                        } else {
                            recordMap.put(column.getName(), ConvertUtil.bytesToBase64((byte[]) value));
                        }
                    } else {
                        recordMap.put(column.getName(), value);
                    }
                }
                records.add(recordMap);
            }

            // Client方式（新版数据访问接口）不支持下推WHERE值过滤和ORDER BY，
            // 在内存中按IGinX-SQL语义执行，保证与SQL方式结果一致
            records = applyFiltersAndSort(records, request);

            // 应用分页（等价于SQL的 LIMIT pageSize OFFSET (pageNum-1)*pageSize）
            int offset = (request.getPageNum() - 1) * request.getPageSize();
            int limit = request.getPageSize();
            if (offset < records.size()) {
                records = new ArrayList<>(records.subList(offset, Math.min(offset + limit, records.size())));
            } else {
                records = new ArrayList<>();
            }

            return new TableDto(columns, records);
        } catch (Exception e) {
            log.error("Client方式查询也失败", e);
            return new TableDto(new ArrayList<>(), new ArrayList<>());
        }
    }

    /**
     * 在内存中按IGinX-SQL语义执行WHERE过滤（手册3.2.3.2值过滤、3.2.3.7模糊查询）
     * 和ORDER BY排序（手册3.2.3.15，默认升序），与buildQuerySql生成的SQL语义保持一致
     */
    private List<Map<String, Object>> applyFiltersAndSort(List<Map<String, Object>> records, RelationalQueryRequest request) {
        List<Map<String, Object>> result = records;
        if (request.getFilters() != null && !request.getFilters().isEmpty()) {
            result = new ArrayList<>();
            for (Map<String, Object> record : records) {
                if (evaluateFilters(request.getFilters(), record)) {
                    result.add(record);
                }
            }
        }
        if (StringUtils.hasText(request.getSortField())) {
            boolean desc = "DESC".equalsIgnoreCase(request.getSortDirection());
            Comparator<Map<String, Object>> comparator = Comparator.comparing(
                    r -> toComparable(r.get(request.getSortField())),
                    Comparator.nullsLast(Comparator.naturalOrder()));
            if (desc) {
                comparator = comparator.reversed();
            }
            result.sort(comparator);
        }
        return result;
    }

    /**
     * 按filter条件列表求值，支持AND/OR优先级和括号分组，
     * 与buildWhereClause生成的SQL表达式语义一致
     */
    private boolean evaluateFilters(List<RelationalQueryRequest.FilterCondition> filters, Map<String, Object> record) {
        return evalOrExpr(filters, new int[]{0}, record);
    }

    /** OR表达式：AND表达式 (OR AND表达式)*，OR优先级最低 */
    private boolean evalOrExpr(List<RelationalQueryRequest.FilterCondition> filters, int[] index, Map<String, Object> record) {
        boolean value = evalAndExpr(filters, index, record);
        while (index[0] < filters.size()
                && "OR".equalsIgnoreCase(filters.get(index[0]).getLogicOperator())) {
            boolean right = evalAndExpr(filters, index, record);
            value = value || right;
        }
        return value;
    }

    /** AND表达式：单元 (AND 单元)* */
    private boolean evalAndExpr(List<RelationalQueryRequest.FilterCondition> filters, int[] index, Map<String, Object> record) {
        boolean value = evalUnit(filters, index, record);
        while (index[0] < filters.size()
                && "AND".equalsIgnoreCase(filters.get(index[0]).getLogicOperator())) {
            boolean right = evalUnit(filters, index, record);
            value = value && right;
        }
        return value;
    }

    /** 单元：括号分组（组内递归求值）| 单个条件 */
    private boolean evalUnit(List<RelationalQueryRequest.FilterCondition> filters, int[] index, Map<String, Object> record) {
        RelationalQueryRequest.FilterCondition cond = filters.get(index[0]);
        if (Boolean.TRUE.equals(cond.getStartGroup())) {
            // 找到与之配对的endGroup下标，组内按完整表达式递归求值
            int depth = 0;
            int groupEnd = -1;
            for (int j = index[0]; j < filters.size(); j++) {
                if (Boolean.TRUE.equals(filters.get(j).getStartGroup())) {
                    depth++;
                }
                if (Boolean.TRUE.equals(filters.get(j).getEndGroup())) {
                    depth--;
                    if (depth == 0) {
                        groupEnd = j;
                        break;
                    }
                }
            }
            if (groupEnd < 0) {
                groupEnd = filters.size() - 1;
            }
            boolean value = evalOrExpr(filters.subList(index[0] + 1, groupEnd + 1), new int[]{0}, record);
            index[0] = groupEnd + 1;
            return value;
        }
        index[0]++;
        return evalCondition(cond, record);
    }

    /** 单个条件求值，操作符语义与buildCondition生成的SQL保持一致 */
    private boolean evalCondition(RelationalQueryRequest.FilterCondition filter, Map<String, Object> record) {
        String field = filter.getField();
        String operator = filter.getOperator() == null ? "=" : filter.getOperator().trim();
        String op = operator.toUpperCase();
        String expected = filter.getValue();
        Object actual = record.get(field);
        String actualStr = actual == null ? null : String.valueOf(actual);

        switch (op) {
            case "LIKE":
                // 手册3.2.3.7：like为正则匹配
                return actualStr != null && actualStr.matches(expected == null ? "" : expected);
            case "包含":
                // 与buildCondition一致：转换为正则的包含匹配
                return actualStr != null && actualStr.matches("^.*" + expected + ".*");
            case "IN":
                return matchesIn(actual, expected, true);
            case "NOT IN":
                return matchesIn(actual, expected, false);
            case "=":
            case "==":
                return compareEquals(actual, expected);
            case "!=":
                return !compareEquals(actual, expected);
            case ">":
            case "<":
            case ">=":
            case "<=":
                int cmp = compareValues(actual, expected);
                if (cmp == Integer.MIN_VALUE) {
                    return false;
                }
                switch (op) {
                    case ">":  return cmp > 0;
                    case "<":  return cmp < 0;
                    case ">=": return cmp >= 0;
                    default:   return cmp <= 0;
                }
            default:
                // 与buildCondition一致：默认按等于处理
                return compareEquals(actual, expected);
        }
    }

    /** IN/NOT IN求值；SQL语义下NULL参与比较结果为false */
    private boolean matchesIn(Object actual, String rawValue, boolean expectMatch) {
        if (actual == null) {
            return false;
        }
        boolean matched = false;
        if (rawValue != null) {
            for (String v : rawValue.split(",")) {
                if (compareEquals(actual, v.trim())) {
                    matched = true;
                    break;
                }
            }
        }
        return expectMatch == matched;
    }

    /** 等值比较，数字按数值比较、布尔按布尔比较，其余按字符串比较 */
    private boolean compareEquals(Object actual, String expected) {
        if (actual == null || expected == null) {
            return actual == null && expected == null;
        }
        if (actual instanceof Number && isNumeric(expected)) {
            return ((Number) actual).doubleValue() == Double.parseDouble(expected.trim());
        }
        if (actual instanceof Boolean) {
            return actual.equals(Boolean.parseBoolean(expected.trim()));
        }
        return String.valueOf(actual).equals(expected);
    }

    /** 比较，返回-1/0/1；无法比较（空值或类型不匹配）返回Integer.MIN_VALUE */
    private int compareValues(Object actual, String expected) {
        if (actual == null || expected == null) {
            return Integer.MIN_VALUE;
        }
        if (actual instanceof Number && isNumeric(expected)) {
            return Double.compare(((Number) actual).doubleValue(), Double.parseDouble(expected.trim()));
        }
        return Integer.signum(String.valueOf(actual).compareTo(expected));
    }

    private boolean isNumeric(String str) {
        if (str == null || str.trim().isEmpty()) {
            return false;
        }
        try {
            Double.parseDouble(str.trim());
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /** 排序键归一化：数值统一按double比较，其余（String/Boolean）本身可比较 */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private Comparable toComparable(Object value) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return (Comparable) value;
    }

    /** 根据timePrecision计算最大时间（10000-01-01 23:59:59.999） */
    private long calculateMaxTime(Integer timePrecisionValue) {
        // 10000-01-01 23:59:59.999 毫秒级时间戳
        long maxTimeMs = 253402300799999L;
        
        if (timePrecisionValue == null) {
            return maxTimeMs; // 默认毫秒
        }
        
        TimePrecision timePrecision = TimePrecision.findByValue(timePrecisionValue);
        if (timePrecision == null) {
            return maxTimeMs; // 默认毫秒
        }
        
        // 根据不同的时间精度转换为对应的单位
        switch (timePrecision) {
            case NS: // 纳秒：毫秒 * 1,000,000
                return maxTimeMs * 1000000;
            case US: // 微秒：毫秒 * 1,000
                return maxTimeMs * 1000;
            case MS: // 毫秒：不转换
                return maxTimeMs;
            case S: // 秒：毫秒 / 1,000
                return maxTimeMs / 1000;
            case MIN: // 分：毫秒 / 60,000
                return maxTimeMs / 60000;
            case HOUR: // 时：毫秒 / 3,600,000
                return maxTimeMs / 3600000;
            case DAY: // 天：毫秒 / 86,400,000
                return maxTimeMs / 86400000;
            case WEEK: // 周：毫秒 / 604,800,000
                return maxTimeMs / 604800000;
            case MONTH: // 月：毫秒 / 25,920,000,000（近似）
                return maxTimeMs / 2592000000L;
            case YEAR: // 年：毫秒 / 315,360,000,000（近似）
                return maxTimeMs / 31536000000L;
            default:
                return maxTimeMs;
        }
    }

    /**
     * Excel导出关系数据
     */
    public byte[] exportDataToExcel(RelationalQueryRequest request) {
        try {
            // 构建导出SQL查询语句（不包含分页，查询所有数据）
            String sql = buildExportSql(request);
            
            log.info("执行导出SQL: {}", sql);
            
            // iginxSession.openSession();
            SessionExecuteSqlResult res = iginxSession.executeSql(sql);
            TableDto tableDto = convertTableDto(res);
            // iginxSession.closeSession();
            
            if (tableDto.getRecords().isEmpty()) {
                log.warn("没有数据可导出");
                return new byte[0];
            }
            
            // 创建Excel工作簿
            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet(request.getTableName());
            
            // 创建表头样式
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 12);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);
            
            // 创建数据样式
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            
            // 写入表头
            List<String> headers = tableDto.getHeader();
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(headerStyle);
            }
            
            // 写入数据
            for (int i = 0; i < tableDto.getRecords().size(); i++) {
                Row row = sheet.createRow(i + 1);
                Map<String, Object> record = tableDto.getRecords().get(i);
                
                for (int j = 0; j < headers.size(); j++) {
                    String header = headers.get(j);
                    Object value = record.get(header);
                    
                    Cell cell = row.createCell(j);
                    if (value != null) {
                        if (value instanceof Number) {
                            cell.setCellValue(((Number) value).doubleValue());
                        } else {
                            cell.setCellValue(value.toString());
                        }
                    } else {
                        cell.setCellValue("");
                    }
                    cell.setCellStyle(dataStyle);
                }
            }
            
            // 自动调整列宽
            for (int i = 0; i < headers.size(); i++) {
                sheet.autoSizeColumn(i);
                // 设置最小列宽
                if (sheet.getColumnWidth(i) < 2000) {
                    sheet.setColumnWidth(i, 2000);
                }
                // 设置最大列宽
                if (sheet.getColumnWidth(i) > 8000) {
                    sheet.setColumnWidth(i, 8000);
                }
            }
            
            // 写入字节数组
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            workbook.close();
            
            byte[] result = outputStream.toByteArray();
            outputStream.close();
            
            return result;
            
        } catch (Exception e) {
            log.error("Excel导出失败", e);
            throw new RuntimeException("Excel导出失败: " + e.getMessage(), e);
        }
    }

    /**
     * 流式Excel导出关系数据（支持大数据量）
     */
    public void exportDataToExcelStream(RelationalQueryRequest request, OutputStream outputStream) {
        SXSSFWorkbook workbook = null;
        try {
            // 构建基础SQL查询语句（不包含分页）
            String baseSql = buildQuerySql(request);
            
            log.info("开始流式导出SQL: {}", baseSql);
            
            // 创建流式Excel工作簿，设置行访问窗口为100
            workbook = new SXSSFWorkbook(100);
            Sheet sheet = workbook.createSheet(request.getTableName());
            
            // 创建表头样式
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 12);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);
            
            // 创建数据样式
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            
            // 先查询一次获取表头
            // iginxSession.openSession();
            SessionExecuteSqlResult headerRes = iginxSession.executeSql(baseSql + " LIMIT 1;");
            // iginxSession.closeSession();
            
            if (headerRes.getPaths().isEmpty()) {
                log.warn("没有表头信息");
                return;
            }

            List<String> headers = new ArrayList<>();
            if (headerRes.getKeys() != null && headerRes.getKeys().length > 0){
                headers.add("key");
            }
            headers.addAll(headerRes.getPaths());
            
            // 写入表头
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(headerStyle);
            }
            
            // 分批查询和写入数据
            final int batchSize = 1000;
            int offset = 0;
            int totalProcessed = 0;
            boolean hasMoreData = true;
            
            log.info("开始分批查询和写入数据，批次大小: {}", batchSize);
            
            while (hasMoreData) {
                // 构建分页查询SQL
                String batchSql = baseSql + String.format(" LIMIT %s OFFSET %s;", batchSize, offset);
                
                // iginxSession.openSession();
                SessionExecuteSqlResult batchRes = iginxSession.executeSql(batchSql);
                List<Map<String, Object>> records = getKeyRecords(batchRes);
                // iginxSession.closeSession();
                
                if (records.isEmpty()) {
                    hasMoreData = false;
                    break;
                }
                
                // 写入当前批次数据
                for (int i = 0; i < records.size(); i++) {
                    Row row = sheet.createRow(totalProcessed + i + 1);
                    Map<String, Object> record = records.get(i);
                    
                    for (int j = 0; j < headers.size(); j++) {
                        String header = headers.get(j);
                        Object value = record.get(header);
                        
                        Cell cell = row.createCell(j);
                        if (value != null) {
                            if (value instanceof Number) {
                                cell.setCellValue(((Number) value).doubleValue());
                            } else {
                                cell.setCellValue(value.toString());
                            }
                        } else {
                            cell.setCellValue("");
                        }
                        cell.setCellStyle(dataStyle);
                    }
                }
                
                totalProcessed += records.size();
                offset += batchSize;
                
                log.info("已处理 {} 条记录，当前批次: {}", totalProcessed, records.size());
                
                // 如果返回的记录数小于批次大小，说明没有更多数据了
                if (records.size() < batchSize) {
                    hasMoreData = false;
                }
            }
            
            // 设置固定列宽（SXSSFWorkbook不支持autoSizeColumn）
            for (int i = 0; i < headers.size(); i++) {
                sheet.setColumnWidth(i, 4000); // 设置固定列宽约30个字符
            }
            
            // 直接写入到输出流
            workbook.write(outputStream);
            outputStream.flush();
            
            log.info("流式Excel导出成功，总数据条数: {}", totalProcessed);
            
        } catch (Exception e) {
            log.error("流式Excel导出失败", e);
            throw new RuntimeException("Excel导出失败: " + e.getMessage(), e);
        } finally {
            try {
                if (workbook != null) {
                    // 清理临时文件
                    ((SXSSFWorkbook) workbook).dispose();
                    workbook.close();
                }
                outputStream.close();
            } catch (IOException e) {
                log.error("关闭流失败", e);
            }
        }
    }

    /**
     * 构建WHERE子句，支持AND和OR逻辑以及括号分组
     */
    public String buildWhereClause(List<RelationalQueryRequest.FilterCondition> filters) {
        if (filters == null || filters.isEmpty()) {
            return " 1=1 ";
        }
        
        StringBuilder whereClause = new StringBuilder();
        
        for (int i = 0; i < filters.size(); i++) {
            RelationalQueryRequest.FilterCondition filter = filters.get(i);
            
            // 验证筛选条件
            if (!StringUtils.hasText(filter.getField()) || 
                !StringUtils.hasText(filter.getOperator()) || 
                !StringUtils.hasText(filter.getValue())) {
                continue;
            }
            
            // 添加开始括号
            if (Boolean.TRUE.equals(filter.getStartGroup())) {
                whereClause.append("(");
            }
            
            // 添加逻辑操作符（除了第一个条件）
            if (i > 0 && StringUtils.hasText(filter.getLogicOperator())) {
                whereClause.append(" ").append(filter.getLogicOperator()).append(" ");
            }
            
            // 添加筛选条件
            String condition = buildCondition(filter);
            whereClause.append(condition);
            
            // 添加结束括号
            if (Boolean.TRUE.equals(filter.getEndGroup())) {
                whereClause.append(")");
            }
        }
        
        return whereClause.toString();
    }

    /**
     * 构建查询SQL语句
     */
    private String buildQuerySql(RelationalQueryRequest request) {
        StringBuilder sql = new StringBuilder("SELECT * FROM ").append(request.getTableName());
        
        // 添加WHERE条件
        String whereClause = buildWhereClause(request.getFilters());
        if (StringUtils.hasText(whereClause)) {
            sql.append(" WHERE ").append(whereClause);
        }
        
        // 添加ORDER BY排序条件
        if (StringUtils.hasText(request.getSortField())) {
            sql.append(" ORDER BY ").append(request.getSortField());
            if (StringUtils.hasText(request.getSortDirection())) {
                sql.append(" ").append(request.getSortDirection());
            }
        }
        
        return sql.toString();
    }

    /**
     * 构建导出SQL语句（带分号）
     */
    private String buildExportSql(RelationalQueryRequest request) {
        return buildQuerySql(request) + ";";
    }

    /**
     * 构建单个筛选条件
     */
    private String buildCondition(RelationalQueryRequest.FilterCondition filter) {
        String field = filter.getField();
        String operator = filter.getOperator();
        String value = filter.getValue();
        
        // 判断值是否需要加引号（数字和布尔值不需要）
        boolean shouldQuote = shouldQuoteValue(value);
        String formattedValue = shouldQuote ? "'" + value + "'" : value;
        
        switch (operator.toUpperCase()) {
            case "=":
            case "==":
                return field + " = " + formattedValue;
            case "!=":
                return field + " != " + formattedValue;
            case ">":
                return field + " > " + formattedValue;
            case "<":
                return field + " < " + formattedValue;
            case ">=":
                return field + " >= " + formattedValue;
            case "<=":
                return field + " <= " + formattedValue;
            case "IN":
                // 处理IN条件，支持逗号分隔的值
                String[] inValues = value.split(",");
                String inClause = String.join(",", java.util.Arrays.stream(inValues)
                    .map(v -> shouldQuoteValue(v.trim()) ? "'" + v.trim() + "'" : v.trim())
                    .toArray(String[]::new));
                return field + " IN (" + inClause + ")";
            case "NOT IN":
                // 处理NOT IN条件
                String[] notInValues = value.split(",");
                String notInClause = String.join(",", java.util.Arrays.stream(notInValues)
                    .map(v -> shouldQuoteValue(v.trim()) ? "'" + v.trim() + "'" : v.trim())
                    .toArray(String[]::new));
                return field + " NOT IN (" + notInClause + ")";
            case "LIKE":
                // 处理LIKE条件，支持正则表达式
                return field + " LIKE '" + value + "'";
            case "包含":
                // 转换为正则表达式的包含
                return field + " LIKE '^.*" + value + ".*'";
            default:
                // 默认使用等于
                return field + " = " + formattedValue;
        }
    }

    /**
     * 判断字符串值是否需要加引号
     * 数字和布尔值不需要加引号，其他类型需要
     */
    private boolean shouldQuoteValue(String str) {
        if (str == null || str.isEmpty()) {
            return true;
        }
        
        String trimmed = str.trim();
        
        // 检查是否为布尔值
        if (trimmed.equalsIgnoreCase("true") || trimmed.equalsIgnoreCase("false")) {
            return false;
        }
        
        // 检查是否为数字
        try {
            Double.parseDouble(trimmed);
            return false;
        } catch (NumberFormatException e) {
            return true;
        }
    }

    @NonNullDecl
    public List<Map<String, Object>> getKeyRecords(SessionExecuteSqlResult res) {
        List<String> header = res.getPaths();
        List<Map<String, Object>> records = new ArrayList<>();
        List<List<Object>>  rows = res.getValues();
        for(int j = 0; j < rows.size(); j++) {
            Map<String, Object> rs = new LinkedHashMap<>();
            long[] keys = res.getKeys();
            if (keys != null && keys.length > 0){
                rs.put("key", keys[j]);
            }
            List<Object> row = rows.get(j);
            for (int i=0; i<=header.size() -1; i++){
                Object value = row.get(i);
                if (value instanceof byte[]) {
                    rs.put(header.get(i), new String((byte[]) value, StandardCharsets.UTF_8));
                } else {
                    rs.put(header.get(i), row.get(i));
                }
            }
            records.add(rs);
        };
        return records;
    }

    private TableDto convertTableDto(SessionExecuteSqlResult res) {
        List<Map<String, Object>> records = getKeyRecords(res);
        List<String> keys = new ArrayList<>();
        if (res.getKeys() != null && res.getKeys().length > 0){
            keys.add("key");
        }
        keys.addAll(res.getPaths());
        return new TableDto(keys, records);
    }

    public Object countData(RelationalQueryRequest request) {
        try {
            // 构建COUNT查询SQL
            String sql = buildCountSql(request);
            
            log.info("执行COUNT SQL: {}", sql);
            
            // iginxSession.openSession();
            SessionExecuteSqlResult res = iginxSession.executeSql(sql);
            // iginxSession.closeSession();
            
            return res.getValues().get(0).get(0);
        } catch (Exception e) {
            log.error("查询失败", e);
            return 0;
        }
    }

    /**
     * 构建COUNT查询SQL语句
     */
    private String buildCountSql(RelationalQueryRequest request) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(1) FROM ").append(request.getTableName());
        
        // 添加WHERE条件（与查询相同的逻辑）
        String whereClause = buildWhereClause(request.getFilters());
        if (StringUtils.hasText(whereClause)) {
            sql.append(" WHERE ").append(whereClause);
        }
        
        // COUNT查询不需要排序，直接返回
        return sql.append(";").toString();
    }
}
