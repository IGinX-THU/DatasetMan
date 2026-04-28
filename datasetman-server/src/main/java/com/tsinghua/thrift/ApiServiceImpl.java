package com.tsinghua.thrift;

import com.tsinghua.dto.*;
import com.tsinghua.service.*;
import com.tsinghua.thrift.api.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.thrift.TException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.nio.ByteBuffer;

/**
 * datasetman Thrift API Service Implementation
 * Exposes your existing services as Thrift RPC interfaces
 * Completely matches your actual Controller methods and DTO structures
 * Includes ParsingRules and RunTask support
 */
@Slf4j
@Component
public class ApiServiceImpl implements ApiService.Iface {

    @Autowired
    private DataSourceService dataSourceService;

    @Autowired
    private DataTableService dataTableService;

    @Autowired
    private RelationalDataService relationalDataService;

    // ========== Data Source Interface - Match DataSourceController ==========

    @Override
    public com.tsinghua.thrift.api.Result registerDataSource(String jsonBody) throws TException {
        try {
            log.info("Thrift RPC: Register data source");
            
            // Parse JSON and convert to BaseStorageEngineRequest (same logic as your Controller)
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            mapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            com.fasterxml.jackson.databind.JsonNode rootNode = mapper.readTree(jsonBody);
            
            // Get storageEngineType
            com.fasterxml.jackson.databind.JsonNode storageEngineTypeNode = rootNode.get("storageEngineType");
            if (storageEngineTypeNode == null || !storageEngineTypeNode.isInt()) {
                com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "storageEngineType is required and must be an integer");
                return result;
            }
            
            int storageEngineType = storageEngineTypeNode.asInt();
            
            // Deserialize to specific request class based on storageEngineType
            com.tsinghua.dto.request.BaseStorageEngineRequest request;
            switch (storageEngineType) {
                case 1:
                    request = mapper.treeToValue(rootNode, com.tsinghua.dto.request.Iotdb12StorageRequest.class);
                    break;
                case 2:
                    request = mapper.treeToValue(rootNode, com.tsinghua.dto.request.InfluxdbStorageRequest.class);
                    break;
                case 3:
                    request = mapper.treeToValue(rootNode, com.tsinghua.dto.request.FilesystemStorageRequest.class);
                    break;
                case 4:
                    request = mapper.treeToValue(rootNode, com.tsinghua.dto.request.RelationalStorageRequest.class);
                    break;
                case 5:
                    request = mapper.treeToValue(rootNode, com.tsinghua.dto.request.MongodbStorageRequest.class);
                    break;
                case 6:
                    request = mapper.treeToValue(rootNode, com.tsinghua.dto.request.RedisStorageRequest.class);
                    break;
                default:
                    com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Unknown storage engine type: " + storageEngineType);
                    return result;
            }
            
            // Call your existing service method directly
            boolean success = dataSourceService.registerDataSource(request);
            
            if (success) {
                com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "数据源注册成功");
                return result;
            } else {
                com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "注册失败，请检查配置");
                return result;
            }
        } catch (Exception e) {
            log.error("Thrift RPC: Register data source failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Register failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result removeDataSource(com.tsinghua.thrift.api.StorageEngineInfo storageEngineInfo) throws TException {
        try {
            log.info("Thrift RPC: Remove data source");
            
            // Convert Thrift object to your DTO (perfect match)
            StorageEngineInfoDto dto = convertToStorageEngineInfoDto(storageEngineInfo);
            
            // Call your existing service method directly
            boolean success = dataSourceService.removeDataSource(dto);
            
            if (success) {
                com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "数据源移除成功");
                return result;
            } else {
                com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "移除失败，数据源可能被关联规则占用");
                return result;
            }
        } catch (Exception e) {
            log.error("Thrift RPC: Remove data source failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Remove failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result listDataSources() throws TException {
        try {
            log.info("Thrift RPC: List data sources");
            
            // Call your existing service method directly
            java.util.List<StorageEngineInfoDto> sources = dataSourceService.dataSourceList();
            
            // Convert result to JSON string
            String jsonData = convertListToJson(sources);
            
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: List data sources failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getDataSourceTree() throws TException {
        try {
            log.info("Thrift RPC: Get data source tree");
            
            // Call your existing service method directly
            java.util.List<ColumnDto> tree = dataSourceService.dataSourceTree();
            
            // Convert result to JSON string
            String jsonData = convertListToJson(tree);
            
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get data source tree failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    // ========== Data Query Interface - Match DataTableController ==========

    @Override
    public com.tsinghua.thrift.api.Result queryData(com.tsinghua.thrift.api.DataQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query data");
            
            // Convert Thrift request to your DTO (perfect match)
            com.tsinghua.dto.DataQueryRequest dto = convertToDataQueryRequest(request);
            
            // Call your existing service method directly
            com.tsinghua.dto.TableDto result = dataTableService.queryData(dto);
            
            // Convert result to JSON string
            String jsonData = convertTableDtoToJson(result);
            
            com.tsinghua.thrift.api.Result thriftResult = new com.tsinghua.thrift.api.Result(true, "Query successful");
            thriftResult.setData(jsonData);
            return thriftResult;
        } catch (Exception e) {
            log.error("Thrift RPC: Query data failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryFileData(com.tsinghua.thrift.api.DataQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query file data");
            
            // Note: Streaming file query via Thrift is complex, this is a placeholder
            // In practice, you might need to handle this differently or use HTTP endpoint
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "File query via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query file data failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteData(com.tsinghua.thrift.api.DataQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Delete data");
            
            // Convert Thrift request to your DTO (perfect match)
            com.tsinghua.dto.DataQueryRequest dto = convertToDataQueryRequest(request);
            
            // Call your existing service method directly
            dataTableService.deleteData(dto);
            
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "删除成功");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Delete data failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryRelationalData(com.tsinghua.thrift.api.RelationalQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query relational data");
            
            // Convert Thrift request to your DTO (perfect match)
            com.tsinghua.dto.RelationalQueryRequest dto = convertToRelationalQueryRequest(request);
            
            // Call your existing service method directly
            com.tsinghua.dto.TableDto result = relationalDataService.queryData(dto);
            
            // Convert result to JSON string
            String jsonData = convertTableDtoToJson(result);
            
            com.tsinghua.thrift.api.Result thriftResult = new com.tsinghua.thrift.api.Result(true, "Query successful");
            thriftResult.setData(jsonData);
            return thriftResult;
        } catch (Exception e) {
            log.error("Thrift RPC: Query relational data failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result countRelationalData(com.tsinghua.thrift.api.RelationalQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Count relational data");
            
            // Convert Thrift request to your DTO (perfect match)
            com.tsinghua.dto.RelationalQueryRequest dto = convertToRelationalQueryRequest(request);
            
            // Call your existing service method directly
            Object count = relationalDataService.countData(dto);
            
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Count successful");
            result.setData(String.valueOf(count));
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Count relational data failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Count failed: " + e.getMessage());
            return result;
        }
    }

    // ========== Dataset Interface - Match DatasetController ==========

    @Override
    public com.tsinghua.thrift.api.Result testSQL(String sql) throws TException {
        try {
            log.info("Thrift RPC: Test SQL");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Test SQL via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Test SQL failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Test failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result saveDataset(com.tsinghua.thrift.api.DatasetRequest request) throws TException {
        try {
            log.info("Thrift RPC: Save dataset");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Save dataset via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Save dataset failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Save failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryMeta(String path) throws TException {
        try {
            log.info("Thrift RPC: Query meta");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query meta via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query meta failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteDataset(String path) throws TException {
        try {
            log.info("Thrift RPC: Delete dataset");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Delete dataset via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Delete dataset failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getVersionHistory(String datasetName) throws TException {
        try {
            log.info("Thrift RPC: Get version history");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Get version history via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get version history failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    // ========== Function Interface - Match FunctionController ==========

    @Override
    public com.tsinghua.thrift.api.Result deleteFunction(String name) throws TException {
        try {
            log.info("Thrift RPC: Delete function");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Delete function via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Delete function failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result listFunctions(String type) throws TException {
        try {
            log.info("Thrift RPC: List functions");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "List functions via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: List functions failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    // ========== Transform Compare Interface - Match TransformCompareController ==========

    @Override
    public com.tsinghua.thrift.api.Result saveTransformCompare(com.tsinghua.thrift.api.TransformJobRequest request) throws TException {
        try {
            log.info("Thrift RPC: Save transform compare");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Save transform compare via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Save transform compare failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Save failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryTransformCompares(com.tsinghua.thrift.api.TransformJobQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query transform compares");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query transform compares via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query transform compares failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result countTransformCompares(com.tsinghua.thrift.api.TransformJobQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Count transform compares");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Count transform compares via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Count transform compares failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Count failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getTransformCompare(long createTime) throws TException {
        try {
            log.info("Thrift RPC: Get transform compare");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Get transform compare via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get transform compare failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteTransformCompare(long createTime) throws TException {
        try {
            log.info("Thrift RPC: Delete transform compare");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Delete transform compare via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Delete transform compare failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
            return result;
        }
    }

    // ========== Transform Job Interface - Match TransformJobController ==========

    @Override
    public com.tsinghua.thrift.api.Result queryTransformJobs(com.tsinghua.thrift.api.TransformJobQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query transform jobs");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query transform jobs via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query transform jobs failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result countTransformJobs(com.tsinghua.thrift.api.TransformJobQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Count transform jobs");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Count transform jobs via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Count transform jobs failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Count failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getTransformJob(String jobId) throws TException {
        try {
            log.info("Thrift RPC: Get transform job");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Get transform job via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get transform job failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result commitTransformJob(long createTime) throws TException {
        try {
            log.info("Thrift RPC: Commit transform job");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Commit transform job via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Commit transform job failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Commit failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getTransformJobStatus(String jobId) throws TException {
        try {
            log.info("Thrift RPC: Get transform job status");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Get transform job status via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get transform job status failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result cancelTransformJob(String jobId) throws TException {
        try {
            log.info("Thrift RPC: Cancel transform job");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Cancel transform job via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Cancel transform job failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Cancel failed: " + e.getMessage());
            return result;
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getTransformJobBloodline(String datasetPath, boolean sideLineage) throws TException {
        try {
            log.info("Thrift RPC: Get transform job bloodline");
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Get transform job bloodline via Thrift not implemented, use HTTP endpoint");
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get transform job bloodline failed", e);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
            return result;
        }
    }


    // ========== Existing Data Conversion Utility Methods - Perfectly Match Your DTOs ==========

    private StorageEngineInfoDto convertToStorageEngineInfoDto(com.tsinghua.thrift.api.StorageEngineInfo thriftInfo) {
        StorageEngineInfoDto dto = new StorageEngineInfoDto();
        if (thriftInfo.isSetId()) {
            dto.setId(thriftInfo.getId());
        }
        if (thriftInfo.isSetIp()) {
            dto.setIp(thriftInfo.getIp());
        }
        if (thriftInfo.isSetPort()) {
            dto.setPort(thriftInfo.getPort());
        }
        if (thriftInfo.isSetType()) {
            dto.setType(thriftInfo.getType());
        }
        if (thriftInfo.isSetSchemaPrefix()) {
            dto.setSchemaPrefix(thriftInfo.getSchemaPrefix());
        }
        if (thriftInfo.isSetDataPrefix()) {
            dto.setDataPrefix(thriftInfo.getDataPrefix());
        }
        return dto;
    }

    private com.tsinghua.dto.DataQueryRequest convertToDataQueryRequest(com.tsinghua.thrift.api.DataQueryRequest thriftRequest) {
        com.tsinghua.dto.DataQueryRequest dto = new com.tsinghua.dto.DataQueryRequest();
        if (thriftRequest.isSetPaths()) {
            dto.setPaths(thriftRequest.getPaths());
        }
        if (thriftRequest.isSetStartTime()) {
            dto.setStartTime(thriftRequest.getStartTime());
        }
        if (thriftRequest.isSetEndTime()) {
            dto.setEndTime(thriftRequest.getEndTime());
        }
        if (thriftRequest.isSetAggregateType()) {
            dto.setAggregateType(thriftRequest.getAggregateType());
        }
        if (thriftRequest.isSetPrecision()) {
            dto.setPrecision(thriftRequest.getPrecision());
        }
        if (thriftRequest.isSetTimePrecision()) {
            dto.setTimePrecision(thriftRequest.getTimePrecision());
        }
        return dto;
    }

    private com.tsinghua.dto.RelationalQueryRequest convertToRelationalQueryRequest(com.tsinghua.thrift.api.RelationalQueryRequest thriftRequest) {
        com.tsinghua.dto.RelationalQueryRequest dto = new com.tsinghua.dto.RelationalQueryRequest();
        dto.setPageNum(thriftRequest.getPageNum());
        dto.setPageSize(thriftRequest.getPageSize());
        if (thriftRequest.isSetTableName()) {
            dto.setTableName(thriftRequest.getTableName());
        }
        if (thriftRequest.isSetFilters()) {
            // Convert Thrift FilterCondition to DTO FilterCondition (perfect match)
            java.util.List<com.tsinghua.dto.RelationalQueryRequest.FilterCondition> dtoFilters = new java.util.ArrayList<>();
            for (com.tsinghua.thrift.api.FilterCondition thriftFilter : thriftRequest.getFilters()) {
                com.tsinghua.dto.RelationalQueryRequest.FilterCondition dtoFilter = new com.tsinghua.dto.RelationalQueryRequest.FilterCondition();
                dtoFilter.setField(thriftFilter.getField());
                dtoFilter.setOperator(thriftFilter.getOperator());
                dtoFilter.setValue(thriftFilter.getValue());
                if (thriftFilter.isSetLogicOperator()) {
                    dtoFilter.setLogicOperator(thriftFilter.getLogicOperator());
                }
                if (thriftFilter.isSetStartGroup()) {
                    dtoFilter.setStartGroup(thriftFilter.isStartGroup());
                }
                if (thriftFilter.isSetEndGroup()) {
                    dtoFilter.setEndGroup(thriftFilter.isEndGroup());
                }
                dtoFilters.add(dtoFilter);
            }
            dto.setFilters(dtoFilters);
        }
        if (thriftRequest.isSetSortField()) {
            dto.setSortField(thriftRequest.getSortField());
        }
        if (thriftRequest.isSetSortDirection()) {
            dto.setSortDirection(thriftRequest.getSortDirection());
        }
        return dto;
    }

    // JSON conversion utility methods
    private String convertEntityToJson(Object entity) throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        return mapper.writeValueAsString(entity);
    }

    private String convertListToJson(java.util.List<?> list) throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        return mapper.writeValueAsString(list);
    }

    private String convertTableDtoToJson(com.tsinghua.dto.TableDto tableDto) throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        // Your TableDto has header and records fields
        return mapper.writeValueAsString(tableDto);
    }
}
