package com.tsinghua.thrift;

import com.tsinghua.dto.*;
import com.tsinghua.service.*;
import com.tsinghua.auth.service.RolePermissionService;
import com.tsinghua.auth.service.DataPermissionService;
import com.tsinghua.auth.entity.UserEntity;
import com.tsinghua.auth.entity.RoleEntity;
import com.tsinghua.auth.dto.DataPermissionQueryRequest;
import com.tsinghua.auth.dto.DataPermissionUpdateRequest;
import com.tsinghua.auth.util.AuthUtil;
import com.tsinghua.thrift.api.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.thrift.TException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import java.nio.ByteBuffer;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * datasetman Thrift API Service Implementation
 * Exposes your existing services as Thrift RPC interfaces
 * Completely matches your actual Controller methods and DTO structures
 * Includes ParsingRules and RunTask support
 */
@Slf4j
@Component
public class ApiServiceImpl implements com.tsinghua.thrift.api.ApiService.Iface {

    @Autowired
    private DataSourceService dataSourceService;

    @Autowired
    private DataTableService dataTableService;

    @Autowired
    private RelationalDataService relationalDataService;

    @Autowired
    private DatasetService datasetService;

    @Autowired
    private DatasetCreationService datasetCreationService;

    @Autowired
    private DatasetVersionService datasetVersionService;

    @Autowired
    private LineageService lineageService;

    @Autowired
    private FunctionService functionService;

    @Autowired
    private TransformCompareService transformCompareService;

    @Autowired
    private TransformJobService transformJobService;

    @Autowired
    private RolePermissionService rolePermissionService;

    @Autowired
    private DataPermissionService dataPermissionService;

    @Autowired
    private ApiGenerationService apiGenerationService;

    @Autowired
    private EvaluationCriteriaService evaluationCriteriaService;

    @Autowired
    private QualityAssessmentService qualityAssessmentService;

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
            Object result = datasetService.testSQL(sql);
            String jsonData = convertEntityToJson(result);
            com.tsinghua.thrift.api.Result thriftResult = new com.tsinghua.thrift.api.Result(true, "Test successful");
            thriftResult.setData(jsonData);
            return thriftResult;
        } catch (Exception e) {
            log.error("Thrift RPC: Test SQL failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Test failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result saveDataset(com.tsinghua.thrift.api.DatasetRequest request) throws TException {
        try {
            log.info("Thrift RPC: Save dataset");
            com.tsinghua.dto.DatasetRequest dto = new com.tsinghua.dto.DatasetRequest();
            dto.setDatasetName(request.getDatasetName());
            dto.setDatasetSql(request.getDatasetSql());
            if (request.isSetParent()) {
                dto.setParent(request.getParent());
            }
            if (request.isSetRemark()) {
                dto.setRemark(request.getRemark());
            }
            com.tsinghua.entity.DatasetEntity entity = datasetService.saveDataset(dto);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "保存成功");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Save dataset failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Save failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryMeta(String path) throws TException {
        try {
            log.info("Thrift RPC: Query meta");
            com.tsinghua.entity.DatasetEntity entity = datasetService.queryMeta(path);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query meta failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteDataset(String path) throws TException {
        try {
            log.info("Thrift RPC: Delete dataset");
            datasetService.deleteDataset(path);
            return new com.tsinghua.thrift.api.Result(true, "删除成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Delete dataset failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result createDataset(com.tsinghua.thrift.api.DatasetCreateRequest request) throws TException {
        try {
            log.info("Thrift RPC: Create dataset version");
            com.tsinghua.dto.DatasetCreateRequest dto = new com.tsinghua.dto.DatasetCreateRequest();
            dto.setDatasetName(request.getDatasetName());
            dto.setProvenanceType(request.getProvenanceType());
            if (request.isSetSourcePath()) dto.setSourcePath(request.getSourcePath());
            if (request.isSetImportFileName()) dto.setImportFileName(request.getImportFileName());
            if (request.isSetImportFileBase64()) dto.setImportFileBase64(request.getImportFileBase64());
            if (request.isSetImportKeyColumn()) dto.setImportKeyColumn(request.getImportKeyColumn());
            if (request.isSetSqlSnippetId()) dto.setSqlSnippetId(request.getSqlSnippetId());
            if (request.isSetUpstreamVersionIds()) dto.setUpstreamVersionIds(request.getUpstreamVersionIds());
            if (request.isSetUdfNames()) dto.setUdfNames(request.getUdfNames());
            if (request.isSetTransformCompareCreateTime()) dto.setTransformCompareCreateTime(request.getTransformCompareCreateTime());
            if (request.isSetDescription()) dto.setDescription(request.getDescription());
            if (request.isSetDataModality()) dto.setDataModality(request.getDataModality());
            if (request.isSetProject()) dto.setProject(request.getProject());
            if (request.isSetRemark()) dto.setRemark(request.getRemark());
            com.tsinghua.entity.DatasetVersionEntity entity = datasetCreationService.create(dto);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "创建成功");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Create dataset version failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Create failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getDatasetTree() throws TException {
        try {
            log.info("Thrift RPC: Get dataset tree");
            java.util.List<com.tsinghua.dto.DatasetTreeDTO> tree = datasetVersionService.getDatasetTree();
            String jsonData = convertListToJson(tree);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get dataset tree failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getDatasetVersionMeta(long versionId) throws TException {
        try {
            log.info("Thrift RPC: Get dataset version meta: {}", versionId);
            com.tsinghua.entity.DatasetVersionEntity entity = datasetVersionService.queryVersion(versionId);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get dataset version meta failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getDatasetChanges(String datasetName) throws TException {
        try {
            log.info("Thrift RPC: Get dataset changes: {}", datasetName);
            java.util.List<com.tsinghua.dto.DatasetChangeProcessDTO> changes = lineageService.getChangeProcess(datasetName);
            String jsonData = convertListToJson(changes);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get dataset changes failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getDatasetLineage(long versionId, boolean sideLineage) throws TException {
        try {
            log.info("Thrift RPC: Get dataset lineage: {}, {}", versionId, sideLineage);
            com.tsinghua.dto.LineageGraphDTO graph = lineageService.getLineageGraph(versionId, sideLineage);
            String jsonData = convertEntityToJson(graph);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get dataset lineage failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteDatasetVersion(long versionId) throws TException {
        try {
            log.info("Thrift RPC: Delete dataset version: {}", versionId);
            datasetVersionService.softDeleteVersion(versionId);
            return new com.tsinghua.thrift.api.Result(true, "删除成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Delete dataset version failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
        }
    }

    // ========== Function Interface - Match FunctionController ==========

    @Override
    public com.tsinghua.thrift.api.Result registerTransform(ByteBuffer file, String name, String className) throws TException {
        try {
            log.info("Thrift RPC: Register transform: {}", name);
            byte[] bytes = new byte[file.remaining()];
            file.get(bytes);
            MultipartFile multipartFile = new ByteArrayMultipartFile("file", name + ".py", "application/octet-stream", bytes);
            functionService.registerTransform(multipartFile, name, className);
            return new com.tsinghua.thrift.api.Result(true, "注册成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Register transform failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Register failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result registerUDF(ByteBuffer file, String name, String className, String udfType) throws TException {
        try {
            log.info("Thrift RPC: Register UDF: {}", name);
            byte[] bytes = new byte[file.remaining()];
            file.get(bytes);
            MultipartFile multipartFile = new ByteArrayMultipartFile("file", name + ".py", "application/octet-stream", bytes);
            functionService.registerUDF(multipartFile, name, className, udfType);
            return new com.tsinghua.thrift.api.Result(true, "注册成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Register UDF failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Register failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteFunction(String name) throws TException {
        try {
            log.info("Thrift RPC: Delete function: {}", name);
            functionService.delete(name);
            return new com.tsinghua.thrift.api.Result(true, "删除成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Delete function failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result listFunctions(String type) throws TException {
        try {
            log.info("Thrift RPC: List functions: {}", type);
            java.util.List<com.tsinghua.dto.RegisterTaskInfoDto> functions = functionService.query(type);
            String jsonData = convertListToJson(functions);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: List functions failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public ByteBuffer downloadFunction(String type, String fileName) throws TException {
        try {
            log.info("Thrift RPC: Download function: {}/{}", type, fileName);
            org.springframework.core.io.Resource resource = functionService.downloadFunction(fileName, type);
            try (InputStream is = resource.getInputStream()) {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int len;
                while ((len = is.read(buffer)) != -1) {
                    baos.write(buffer, 0, len);
                }
                return ByteBuffer.wrap(baos.toByteArray());
            }
        } catch (Exception e) {
            log.error("Thrift RPC: Download function failed", e);
            return ByteBuffer.wrap(new byte[0]);
        }
    }

    // ========== Transform Compare Interface - Match TransformCompareController ==========

    @Override
    public com.tsinghua.thrift.api.Result saveTransformCompare(com.tsinghua.thrift.api.TransformJobRequest request) throws TException {
        try {
            log.info("Thrift RPC: Save transform compare");
            com.tsinghua.dto.TransformJobRequest dto = convertToTransformJobRequest(request);
            com.tsinghua.entity.TransformCompareEntity entity = transformCompareService.saveTransform(dto);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "保存成功");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Save transform compare failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Save failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryTransformCompares(com.tsinghua.thrift.api.TransformJobQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query transform compares");
            com.tsinghua.dto.TransformJobQueryRequest dto = convertToTransformJobQueryRequest(request);
            java.util.List<com.tsinghua.entity.TransformCompareEntity> list = transformCompareService.queryJobs(dto);
            String jsonData = convertListToJson(list);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query transform compares failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result countTransformCompares(com.tsinghua.thrift.api.TransformJobQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Count transform compares");
            com.tsinghua.dto.TransformJobQueryRequest dto = convertToTransformJobQueryRequest(request);
            Object count = transformCompareService.countJobs(dto);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Count successful");
            result.setData(String.valueOf(count));
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Count transform compares failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Count failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getTransformCompare(long createTime) throws TException {
        try {
            log.info("Thrift RPC: Get transform compare");
            com.tsinghua.entity.TransformCompareEntity entity = transformCompareService.queryJob(createTime);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get transform compare failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteTransformCompare(long createTime) throws TException {
        try {
            log.info("Thrift RPC: Delete transform compare");
            transformCompareService.deleteJob(createTime);
            return new com.tsinghua.thrift.api.Result(true, "删除成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Delete transform compare failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
        }
    }

    // ========== Transform Job Interface - Match TransformJobController ==========

    @Override
    public com.tsinghua.thrift.api.Result queryTransformJobs(com.tsinghua.thrift.api.TransformJobQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query transform jobs");
            com.tsinghua.dto.TransformJobQueryRequest dto = convertToTransformJobQueryRequest(request);
            java.util.List<com.tsinghua.entity.TransformJobEntity> list = transformJobService.queryJobs(dto);
            String jsonData = convertListToJson(list);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query transform jobs failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result countTransformJobs(com.tsinghua.thrift.api.TransformJobQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Count transform jobs");
            com.tsinghua.dto.TransformJobQueryRequest dto = convertToTransformJobQueryRequest(request);
            Object count = transformJobService.countJobs(dto);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Count successful");
            result.setData(String.valueOf(count));
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Count transform jobs failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Count failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getTransformJob(String jobId) throws TException {
        try {
            log.info("Thrift RPC: Get transform job: {}", jobId);
            com.tsinghua.entity.TransformJobEntity entity = transformJobService.queryJob(jobId);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get transform job failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result commitTransformJob(long createTime) throws TException {
        try {
            log.info("Thrift RPC: Commit transform job: {}", createTime);
            com.tsinghua.entity.TransformJobEntity entity = transformJobService.commitJob(createTime);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "提交成功");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Commit transform job failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Commit failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getTransformJobStatus(String jobId) throws TException {
        try {
            log.info("Thrift RPC: Get transform job status: {}", jobId);
            com.tsinghua.entity.TransformJobEntity entity = transformJobService.statusJob(jobId);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get transform job status failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result cancelTransformJob(String jobId) throws TException {
        try {
            log.info("Thrift RPC: Cancel transform job: {}", jobId);
            com.tsinghua.entity.TransformJobEntity entity = transformJobService.cancelJob(jobId);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "取消成功");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Cancel transform job failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Cancel failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getTransformJobBloodline(String datasetPath, boolean sideLineage) throws TException {
        try {
            log.info("Thrift RPC: Get transform job bloodline: {}", datasetPath);
            java.util.List<com.tsinghua.entity.TransformJobEntity> list = transformJobService.queryAllJobs(datasetPath, null, sideLineage);
            String jsonData = convertListToJson(list);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get transform job bloodline failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    // ========== Data Query - Missing methods ==========

    @Override
    public com.tsinghua.thrift.api.Result importData(com.tsinghua.thrift.api.DataImportRequest config, ByteBuffer file) throws TException {
        try {
            log.info("Thrift RPC: Import data");
            com.tsinghua.dto.DataImportRequest dto = new com.tsinghua.dto.DataImportRequest();
            dto.setTargetPath(config.getTargetPath());
            byte[] bytes = new byte[file.remaining()];
            file.get(bytes);
            MultipartFile multipartFile = new ByteArrayMultipartFile("file", "import_" + System.currentTimeMillis() + ".csv", "application/octet-stream", bytes);
            Long result = dataTableService.importData(multipartFile, dto);
            com.tsinghua.thrift.api.Result thriftResult = new com.tsinghua.thrift.api.Result(true, "导入成功");
            thriftResult.setData(String.valueOf(result));
            return thriftResult;
        } catch (Exception e) {
            log.error("Thrift RPC: Import data failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Import failed: " + e.getMessage());
        }
    }

    @Override
    public ByteBuffer exportData(com.tsinghua.thrift.api.DataQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Export data");
            log.warn("Export data via Thrift returns empty - use HTTP endpoint for file download");
            return ByteBuffer.wrap(new byte[0]);
        } catch (Exception e) {
            log.error("Thrift RPC: Export data failed", e);
            return ByteBuffer.wrap(new byte[0]);
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getTimeRange(com.tsinghua.thrift.api.TimeRangeRequest request) throws TException {
        try {
            log.info("Thrift RPC: Get time range");
            com.tsinghua.dto.TimeRangeRequest dto = new com.tsinghua.dto.TimeRangeRequest();
            dto.setTableName(request.getTableName());
            if (request.isSetInputsBind()) {
                java.util.List<com.tsinghua.dto.InputBindDto> inputs = new java.util.ArrayList<>();
                for (com.tsinghua.thrift.api.InputBindDto thriftInput : request.getInputsBind()) {
                    com.tsinghua.dto.InputBindDto inputDto = new com.tsinghua.dto.InputBindDto();
                    inputDto.setSourceField(thriftInput.getSourceField());
                    inputDto.setTargetField(thriftInput.getTargetField());
                    inputDto.setOperator(thriftInput.getOperator());
                    inputDto.setConversionValue(thriftInput.getConversionValue());
                    inputs.add(inputDto);
                }
                dto.setInputsBind(inputs);
            }
            com.tsinghua.dto.TimeRangeResponse response = dataTableService.getTimeRange(dto);
            String jsonData = convertEntityToJson(response);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get time range failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public ByteBuffer exportRelationalDataToExcel(com.tsinghua.thrift.api.RelationalQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Export relational data to Excel");
            com.tsinghua.dto.RelationalQueryRequest dto = convertToRelationalQueryRequest(request);
            byte[] excelBytes = relationalDataService.exportDataToExcel(dto);
            return ByteBuffer.wrap(excelBytes);
        } catch (Exception e) {
            log.error("Thrift RPC: Export relational data failed", e);
            return ByteBuffer.wrap(new byte[0]);
        }
    }

    // ========== Doc Interface ==========

    @Override
    public ByteBuffer getUserManualFile() throws TException {
        try {
            log.info("Thrift RPC: Get user manual file");
            Path docPath = Paths.get("doc", "用户手册.docx");
            if (!Files.exists(docPath)) {
                log.warn("User manual file not found: {}", docPath);
                return ByteBuffer.wrap(new byte[0]);
            }
            return ByteBuffer.wrap(Files.readAllBytes(docPath));
        } catch (Exception e) {
            log.error("Thrift RPC: Get user manual file failed", e);
            return ByteBuffer.wrap(new byte[0]);
        }
    }

    // ========== API Generation Interface ==========

    @Override
    public com.tsinghua.thrift.api.Result generateJavaCode() throws TException {
        try {
            log.info("Thrift RPC: Generate Java code");
            com.tsinghua.model.Result<?> result = apiGenerationService.generateJavaCode();
            com.tsinghua.thrift.api.Result thriftResult = new com.tsinghua.thrift.api.Result(result.getSuccess(), result.getMessage());
            if (result.getData() != null) {
                thriftResult.setData(String.valueOf(result.getData()));
            }
            return thriftResult;
        } catch (Exception e) {
            log.error("Thrift RPC: Generate Java code failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Generate failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result generateGoCode() throws TException {
        try {
            log.info("Thrift RPC: Generate Go code");
            com.tsinghua.model.Result<?> result = apiGenerationService.generateGoCode();
            com.tsinghua.thrift.api.Result thriftResult = new com.tsinghua.thrift.api.Result(result.getSuccess(), result.getMessage());
            if (result.getData() != null) {
                thriftResult.setData(String.valueOf(result.getData()));
            }
            return thriftResult;
        } catch (Exception e) {
            log.error("Thrift RPC: Generate Go code failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Generate failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result generatePythonCode() throws TException {
        try {
            log.info("Thrift RPC: Generate Python code");
            com.tsinghua.model.Result<?> result = apiGenerationService.generatePythonCode();
            com.tsinghua.thrift.api.Result thriftResult = new com.tsinghua.thrift.api.Result(result.getSuccess(), result.getMessage());
            if (result.getData() != null) {
                thriftResult.setData(String.valueOf(result.getData()));
            }
            return thriftResult;
        } catch (Exception e) {
            log.error("Thrift RPC: Generate Python code failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Generate failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result generateRestfulApiCode() throws TException {
        try {
            log.info("Thrift RPC: Generate RESTful API code");
            com.tsinghua.model.Result<?> result = apiGenerationService.generateRestfulApiCode();
            com.tsinghua.thrift.api.Result thriftResult = new com.tsinghua.thrift.api.Result(result.getSuccess(), result.getMessage());
            if (result.getData() != null) {
                thriftResult.setData(String.valueOf(result.getData()));
            }
            return thriftResult;
        } catch (Exception e) {
            log.error("Thrift RPC: Generate RESTful API code failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Generate failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result generateAllCode() throws TException {
        try {
            log.info("Thrift RPC: Generate all code");
            com.tsinghua.model.Result<java.util.Map<String, String>> result = apiGenerationService.generateAllCode();
            com.tsinghua.thrift.api.Result thriftResult = new com.tsinghua.thrift.api.Result(result.getSuccess(), result.getMessage());
            if (result.getData() != null) {
                thriftResult.setData(convertEntityToJson(result.getData()));
            }
            return thriftResult;
        } catch (Exception e) {
            log.error("Thrift RPC: Generate all code failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Generate failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getGenerationStatus() throws TException {
        return new com.tsinghua.thrift.api.Result(true, "Generation service is ready");
    }

    @Override
    public com.tsinghua.thrift.api.Result validateThriftFile() throws TException {
        try {
            Path thriftFile = Paths.get("thrift", "api.thrift");
            if (Files.exists(thriftFile)) {
                return new com.tsinghua.thrift.api.Result(true, "Thrift file exists and is valid");
            } else {
                return new com.tsinghua.thrift.api.Result(false, "Thrift file not found");
            }
        } catch (Exception e) {
            return new com.tsinghua.thrift.api.Result(false, "Validation failed: " + e.getMessage());
        }
    }

    // ========== Auth Interface ==========

    @Override
    public com.tsinghua.thrift.api.Result login(com.tsinghua.thrift.api.LoginRequest request) throws TException {
        return new com.tsinghua.thrift.api.Result(false, "Login via Thrift not supported, use HTTP /api/auth/login");
    }

    @Override
    public com.tsinghua.thrift.api.Result refreshToken(com.tsinghua.thrift.api.RefreshTokenRequest request) throws TException {
        return new com.tsinghua.thrift.api.Result(false, "Token refresh via Thrift not supported, use HTTP /api/auth/refresh");
    }

    @Override
    public com.tsinghua.thrift.api.Result verifyToken() throws TException {
        try {
            String currentUser = AuthUtil.getCurrentUsername();
            if (currentUser != null && !"unknown".equalsIgnoreCase(currentUser)) {
                com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Token is valid");
                result.setData(currentUser);
                return result;
            }
            return new com.tsinghua.thrift.api.Result(false, "Token is invalid or expired");
        } catch (Exception e) {
            return new com.tsinghua.thrift.api.Result(false, "Verify failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result logout() throws TException {
        return new com.tsinghua.thrift.api.Result(true, "Logout via Thrift not supported, use HTTP /api/auth/logout");
    }

    @Override
    public com.tsinghua.thrift.api.Result getCurrentAuthUser() throws TException {
        try {
            String username = AuthUtil.getCurrentUsername();
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(username);
            return result;
        } catch (Exception e) {
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    // ========== User Management Interface ==========

    @Override
    public com.tsinghua.thrift.api.Result saveUser(com.tsinghua.thrift.api.UserEntity user) throws TException {
        try {
            log.info("Thrift RPC: Save user: {}", user.getUsername());
            UserEntity dto = convertToUserEntity(user);
            rolePermissionService.addUser(dto);
            return new com.tsinghua.thrift.api.Result(true, "保存成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Save user failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Save failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryUsers(com.tsinghua.thrift.api.UserQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query users");
            String username = request.isSetUsername() ? request.getUsername() : null;
            String role = request.isSetRole() ? request.getRole() : null;
            String enabled = request.isSetEnabled() ? request.getEnabled() : null;
            Integer page = request.isSetPage() ? request.getPage() : null;
            Integer pageSize = request.isSetPageSize() ? request.getPageSize() : null;
            java.util.List<UserEntity> users = rolePermissionService.queryUsers(username, role, enabled, page, pageSize);
            String jsonData = convertListToJson(users);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query users failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result countUsers(com.tsinghua.thrift.api.UserQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Count users");
            String username = request.isSetUsername() ? request.getUsername() : null;
            String role = request.isSetRole() ? request.getRole() : null;
            String enabled = request.isSetEnabled() ? request.getEnabled() : null;
            java.util.List<UserEntity> allUsers = rolePermissionService.queryUsers(username, role, enabled, null, null);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Count successful");
            result.setData(String.valueOf(allUsers.size()));
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Count users failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Count failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result allUsers() throws TException {
        try {
            log.info("Thrift RPC: All users");
            java.util.List<UserEntity> users = rolePermissionService.getAllUserEntities();
            String jsonData = convertListToJson(users);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: All users failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryUser(String username) throws TException {
        try {
            log.info("Thrift RPC: Query user: {}", username);
            UserEntity user = rolePermissionService.getUser(username);
            String jsonData = convertEntityToJson(user);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query user failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteUser(String username) throws TException {
        try {
            log.info("Thrift RPC: Delete user: {}", username);
            rolePermissionService.removeUser(username);
            return new com.tsinghua.thrift.api.Result(true, "删除成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Delete user failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result updateUser(com.tsinghua.thrift.api.UserEntity user) throws TException {
        try {
            log.info("Thrift RPC: Update user: {}", user.getUsername());
            UserEntity dto = convertToUserEntity(user);
            rolePermissionService.updateUser(dto);
            return new com.tsinghua.thrift.api.Result(true, "更新成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Update user failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Update failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getRoles() throws TException {
        try {
            log.info("Thrift RPC: Get roles");
            java.util.List<RoleEntity> roles = rolePermissionService.getAllRoles();
            String jsonData = convertListToJson(roles);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get roles failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result changePassword(com.tsinghua.thrift.api.ChangePasswordRequest request) throws TException {
        try {
            log.info("Thrift RPC: Change password: {}", request.getUsername());
            boolean success = rolePermissionService.changePassword(
                request.getUsername(), request.getOldPassword(), request.getNewPassword());
            if (success) {
                return new com.tsinghua.thrift.api.Result(true, "密码修改成功");
            } else {
                return new com.tsinghua.thrift.api.Result(false, "密码修改失败，请检查原密码");
            }
        } catch (Exception e) {
            log.error("Thrift RPC: Change password failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Change password failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getCurrentUser() throws TException {
        try {
            String username = AuthUtil.getCurrentUsername();
            UserEntity user = rolePermissionService.getUser(username);
            String jsonData = convertEntityToJson(user);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get current user failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    // ========== Data Permission Interface ==========

    @Override
    public com.tsinghua.thrift.api.Result listOwnerTables() throws TException {
        try {
            log.info("Thrift RPC: List owner tables");
            java.util.List<com.tsinghua.auth.entity.DataPermissionEntity> tables = dataPermissionService.getOwnerTables();
            String jsonData = convertListToJson(tables);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: List owner tables failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryDataPermissions(com.tsinghua.thrift.api.DataPermissionQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query data permissions");
            DataPermissionQueryRequest dto = new DataPermissionQueryRequest();
            if (request.isSetPage()) {
                dto.setPage(request.getPage());
            }
            if (request.isSetPageSize()) {
                dto.setPageSize(request.getPageSize());
            }
            if (request.isSetTablePrefix()) {
                dto.setTablePrefix(request.getTablePrefix());
            }
            java.util.List<com.tsinghua.auth.entity.DataPermissionEntity> list = dataPermissionService.queryOwnerTables(dto);
            String jsonData = convertListToJson(list);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query data permissions failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result countDataPermissions(com.tsinghua.thrift.api.DataPermissionQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Count data permissions");
            DataPermissionQueryRequest dto = new DataPermissionQueryRequest();
            if (request.isSetPage()) {
                dto.setPage(request.getPage());
            }
            if (request.isSetPageSize()) {
                dto.setPageSize(request.getPageSize());
            }
            if (request.isSetTablePrefix()) {
                dto.setTablePrefix(request.getTablePrefix());
            }
            long count = dataPermissionService.countOwnerTables(dto);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Count successful");
            result.setData(String.valueOf(count));
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Count data permissions failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Count failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result updateDataPermission(com.tsinghua.thrift.api.DataPermissionUpdateRequest request) throws TException {
        try {
            log.info("Thrift RPC: Update data permission: {}", request.getId());
            DataPermissionUpdateRequest dto = new DataPermissionUpdateRequest();
            dto.setId(request.getId());
            if (request.isSetIsPublic()) {
                dto.setIsPublic(request.isIsPublic());
            }
            if (request.isSetVisibleUsers()) {
                dto.setVisibleUsers(request.getVisibleUsers());
            }
            dataPermissionService.updateOwnerPermission(dto);
            return new com.tsinghua.thrift.api.Result(true, "更新成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Update data permission failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Update failed: " + e.getMessage());
        }
    }

    // ========== Conversion utility methods for new types ==========

    private UserEntity convertToUserEntity(com.tsinghua.thrift.api.UserEntity thriftUser) {
        UserEntity entity = new UserEntity();
        entity.setUsername(thriftUser.getUsername());
        if (thriftUser.isSetPassword()) {
            entity.setPassword(thriftUser.getPassword());
        }
        entity.setRole(thriftUser.getRole());
        if (thriftUser.isSetRoleId()) {
            entity.setRoleId(thriftUser.getRoleId());
        }
        entity.setEnabled(thriftUser.isEnabled());
        if (thriftUser.isSetTimestamp()) {
            entity.setTimestamp(thriftUser.getTimestamp());
        }
        return entity;
    }

    private com.tsinghua.dto.TransformJobRequest convertToTransformJobRequest(com.tsinghua.thrift.api.TransformJobRequest thriftRequest) {
        com.tsinghua.dto.TransformJobRequest dto = new com.tsinghua.dto.TransformJobRequest();
        dto.setName(thriftRequest.getName());
        if (thriftRequest.isSetTaskList()) {
            java.util.List<com.tsinghua.dto.TaskInfoDto> taskList = new java.util.ArrayList<>();
            for (com.tsinghua.thrift.api.TaskInfoDto thriftTask : thriftRequest.getTaskList()) {
                com.tsinghua.dto.TaskInfoDto taskDto = new com.tsinghua.dto.TaskInfoDto();
                taskDto.setTaskType(thriftTask.getTaskType());
                taskDto.setDataFlowType(thriftTask.getDataFlowType());
                if (thriftTask.isSetTimeout()) {
                    taskDto.setTimeout(thriftTask.getTimeout());
                }
                if (thriftTask.isSetDataset()) {
                    taskDto.setDataset(thriftTask.getDataset());
                }
                if (thriftTask.isSetPyTaskName()) {
                    taskDto.setPyTaskName(thriftTask.getPyTaskName());
                }
                taskList.add(taskDto);
            }
            dto.setTaskList(taskList);
        }
        if (thriftRequest.isSetExportType()) {
            dto.setExportType(thriftRequest.getExportType());
        }
        if (thriftRequest.isSetExportFile()) {
            dto.setExportFile(thriftRequest.getExportFile());
        }
        if (thriftRequest.isSetSchedule()) {
            dto.setSchedule(thriftRequest.getSchedule());
        }
        if (thriftRequest.isSetCreateTime()) {
            dto.setCreateTime(thriftRequest.getCreateTime());
        }
        return dto;
    }

    private com.tsinghua.dto.TransformJobQueryRequest convertToTransformJobQueryRequest(com.tsinghua.thrift.api.TransformJobQueryRequest thriftRequest) {
        com.tsinghua.dto.TransformJobQueryRequest dto = new com.tsinghua.dto.TransformJobQueryRequest();
        if (thriftRequest.isSetPageNum()) {
            dto.setPageNum(thriftRequest.getPageNum());
        }
        if (thriftRequest.isSetPageSize()) {
            dto.setPageSize(thriftRequest.getPageSize());
        }
        if (thriftRequest.isSetName()) {
            dto.setName(thriftRequest.getName());
        }
        if (thriftRequest.isSetJobState()) {
            dto.setJobState(thriftRequest.getJobState());
        }
        return dto;
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

    // ========== Evaluation Criteria Interface ==========

    @Override
    public com.tsinghua.thrift.api.Result saveEvaluationCriteria(com.tsinghua.thrift.api.EvaluationCriteriaRequest request) throws TException {
        try {
            log.info("Thrift RPC: Save evaluation criteria: {}", request.getName());
            com.tsinghua.dto.EvaluationCriteriaRequest dto = convertToEvaluationCriteriaRequest(request);
            com.tsinghua.entity.EvaluationCriteriaEntity entity = evaluationCriteriaService.saveCriteria(dto);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "保存成功");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Save evaluation criteria failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Save failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryEvaluationCriteria(com.tsinghua.thrift.api.EvaluationCriteriaQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query evaluation criteria");
            com.tsinghua.dto.EvaluationCriteriaQueryRequest dto = convertToEvaluationCriteriaQueryRequest(request);
            java.util.List<com.tsinghua.entity.EvaluationCriteriaEntity> list = evaluationCriteriaService.queryCriteria(dto);
            String jsonData = convertListToJson(list);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query evaluation criteria failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result countEvaluationCriteria(com.tsinghua.thrift.api.EvaluationCriteriaQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Count evaluation criteria");
            com.tsinghua.dto.EvaluationCriteriaQueryRequest dto = convertToEvaluationCriteriaQueryRequest(request);
            Object count = evaluationCriteriaService.countCriteria(dto);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Count successful");
            result.setData(String.valueOf(count));
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Count evaluation criteria failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Count failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getEvaluationCriteria(long id) throws TException {
        try {
            log.info("Thrift RPC: Get evaluation criteria: {}", id);
            com.tsinghua.entity.EvaluationCriteriaEntity entity = evaluationCriteriaService.queryById(id);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get evaluation criteria failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteEvaluationCriteria(long id) throws TException {
        try {
            log.info("Thrift RPC: Delete evaluation criteria: {}", id);
            evaluationCriteriaService.deleteCriteria(id);
            return new com.tsinghua.thrift.api.Result(true, "删除成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Delete evaluation criteria failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
        }
    }

    // ========== Quality Assessment Interface ==========

    @Override
    public com.tsinghua.thrift.api.Result saveQualityAssessment(com.tsinghua.thrift.api.QualityAssessmentRequest request) throws TException {
        try {
            log.info("Thrift RPC: Save quality assessment");
            com.tsinghua.dto.QualityAssessmentRequest dto = convertToQualityAssessmentRequest(request);
            com.tsinghua.entity.QualityAssessmentEntity entity = qualityAssessmentService.saveAssessment(dto);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "保存成功");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Save quality assessment failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Save failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result queryQualityAssessments(com.tsinghua.thrift.api.QualityAssessmentQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Query quality assessments");
            com.tsinghua.dto.QualityAssessmentQueryRequest dto = convertToQualityAssessmentQueryRequest(request);
            java.util.List<com.tsinghua.entity.QualityAssessmentEntity> list = qualityAssessmentService.queryAssessments(dto);
            String jsonData = convertListToJson(list);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Query quality assessments failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result countQualityAssessments(com.tsinghua.thrift.api.QualityAssessmentQueryRequest request) throws TException {
        try {
            log.info("Thrift RPC: Count quality assessments");
            com.tsinghua.dto.QualityAssessmentQueryRequest dto = convertToQualityAssessmentQueryRequest(request);
            Object count = qualityAssessmentService.countAssessments(dto);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Count successful");
            result.setData(String.valueOf(count));
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Count quality assessments failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Count failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result getQualityAssessment(long id) throws TException {
        try {
            log.info("Thrift RPC: Get quality assessment: {}", id);
            com.tsinghua.entity.QualityAssessmentEntity entity = qualityAssessmentService.queryById(id);
            String jsonData = convertEntityToJson(entity);
            com.tsinghua.thrift.api.Result result = new com.tsinghua.thrift.api.Result(true, "Query successful");
            result.setData(jsonData);
            return result;
        } catch (Exception e) {
            log.error("Thrift RPC: Get quality assessment failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Query failed: " + e.getMessage());
        }
    }

    @Override
    public com.tsinghua.thrift.api.Result deleteQualityAssessment(long id) throws TException {
        try {
            log.info("Thrift RPC: Delete quality assessment: {}", id);
            qualityAssessmentService.deleteAssessment(id);
            return new com.tsinghua.thrift.api.Result(true, "删除成功");
        } catch (Exception e) {
            log.error("Thrift RPC: Delete quality assessment failed", e);
            return new com.tsinghua.thrift.api.Result(false, "Delete failed: " + e.getMessage());
        }
    }

    // ========== Conversion utility methods for evaluation/assessment ==========

    private com.tsinghua.dto.DataQualityDimension convertToDataQualityDimension(com.tsinghua.thrift.api.DataQualityDimension thriftDim) {
        if (thriftDim == null) {
            return null;
        }
        com.tsinghua.dto.DataQualityDimension dto = new com.tsinghua.dto.DataQualityDimension();
        if (thriftDim.isSetWeight()) {
            dto.setWeight(thriftDim.getWeight());
        }
        if (thriftDim.isSetTransformId()) {
            dto.setTransformId(thriftDim.getTransformId());
        }
        if (thriftDim.isSetJobId()) {
            dto.setJobId(thriftDim.getJobId());
        }
        if (thriftDim.isSetName()) {
            dto.setName(thriftDim.getName());
        }
        if (thriftDim.isSetExportFile()) {
            dto.setExportFile(thriftDim.getExportFile());
        }
        if (thriftDim.isSetScore()) {
            dto.setScore(thriftDim.getScore());
        }
        return dto;
    }

    private com.tsinghua.dto.EvaluationCriteriaRequest convertToEvaluationCriteriaRequest(com.tsinghua.thrift.api.EvaluationCriteriaRequest thriftRequest) {
        com.tsinghua.dto.EvaluationCriteriaRequest dto = new com.tsinghua.dto.EvaluationCriteriaRequest();
        if (thriftRequest.isSetId()) {
            dto.setId(thriftRequest.getId());
        }
        dto.setName(thriftRequest.getName());
        if (thriftRequest.isSetDescription()) {
            dto.setDescription(thriftRequest.getDescription());
        }
        if (thriftRequest.isSetQcom()) {
            dto.setQcom(convertToDataQualityDimension(thriftRequest.getQcom()));
        }
        if (thriftRequest.isSetQcon()) {
            dto.setQcon(convertToDataQualityDimension(thriftRequest.getQcon()));
        }
        if (thriftRequest.isSetQtim()) {
            dto.setQtim(convertToDataQualityDimension(thriftRequest.getQtim()));
        }
        if (thriftRequest.isSetQval()) {
            dto.setQval(convertToDataQualityDimension(thriftRequest.getQval()));
        }
        if (thriftRequest.isSetOwner()) {
            dto.setOwner(thriftRequest.getOwner());
        }
        return dto;
    }

    private com.tsinghua.dto.EvaluationCriteriaQueryRequest convertToEvaluationCriteriaQueryRequest(com.tsinghua.thrift.api.EvaluationCriteriaQueryRequest thriftRequest) {
        com.tsinghua.dto.EvaluationCriteriaQueryRequest dto = new com.tsinghua.dto.EvaluationCriteriaQueryRequest();
        if (thriftRequest.isSetPageNum()) {
            dto.setPageNum(thriftRequest.getPageNum());
        }
        if (thriftRequest.isSetPageSize()) {
            dto.setPageSize(thriftRequest.getPageSize());
        }
        if (thriftRequest.isSetName()) {
            dto.setName(thriftRequest.getName());
        }
        return dto;
    }

    private com.tsinghua.dto.QualityAssessmentRequest convertToQualityAssessmentRequest(com.tsinghua.thrift.api.QualityAssessmentRequest thriftRequest) {
        com.tsinghua.dto.QualityAssessmentRequest dto = new com.tsinghua.dto.QualityAssessmentRequest();
        if (thriftRequest.isSetId()) {
            dto.setId(thriftRequest.getId());
        }
        if (thriftRequest.isSetCriteriaId()) {
            dto.setCriteriaId(thriftRequest.getCriteriaId());
        }
        if (thriftRequest.isSetCriteriaName()) {
            dto.setCriteriaName(thriftRequest.getCriteriaName());
        }
        if (thriftRequest.isSetDescription()) {
            dto.setDescription(thriftRequest.getDescription());
        }
        if (thriftRequest.isSetQcom()) {
            dto.setQcom(convertToDataQualityDimension(thriftRequest.getQcom()));
        }
        if (thriftRequest.isSetQcon()) {
            dto.setQcon(convertToDataQualityDimension(thriftRequest.getQcon()));
        }
        if (thriftRequest.isSetQtim()) {
            dto.setQtim(convertToDataQualityDimension(thriftRequest.getQtim()));
        }
        if (thriftRequest.isSetQval()) {
            dto.setQval(convertToDataQualityDimension(thriftRequest.getQval()));
        }
        if (thriftRequest.isSetDqi()) {
            dto.setDqi(thriftRequest.getDqi());
        }
        if (thriftRequest.isSetPassed()) {
            dto.setPassed(thriftRequest.getPassed());
        }
        if (thriftRequest.isSetOwner()) {
            dto.setOwner(thriftRequest.getOwner());
        }
        return dto;
    }

    private com.tsinghua.dto.QualityAssessmentQueryRequest convertToQualityAssessmentQueryRequest(com.tsinghua.thrift.api.QualityAssessmentQueryRequest thriftRequest) {
        com.tsinghua.dto.QualityAssessmentQueryRequest dto = new com.tsinghua.dto.QualityAssessmentQueryRequest();
        if (thriftRequest.isSetPageNum()) {
            dto.setPageNum(thriftRequest.getPageNum());
        }
        if (thriftRequest.isSetPageSize()) {
            dto.setPageSize(thriftRequest.getPageSize());
        }
        if (thriftRequest.isSetCriteriaName()) {
            dto.setCriteriaName(thriftRequest.getCriteriaName());
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

    private static class ByteArrayMultipartFile implements MultipartFile {
        private final String name;
        private final String originalFilename;
        private final String contentType;
        private final byte[] content;

        public ByteArrayMultipartFile(String name, String originalFilename, String contentType, byte[] content) {
            this.name = name;
            this.originalFilename = originalFilename;
            this.contentType = contentType;
            this.content = content;
        }

        @Override
        public String getName() {
            return name;
        }

        @Override
        public String getOriginalFilename() {
            return originalFilename;
        }

        @Override
        public String getContentType() {
            return contentType;
        }

        @Override
        public boolean isEmpty() {
            return content == null || content.length == 0;
        }

        @Override
        public long getSize() {
            return content.length;
        }

        @Override
        public byte[] getBytes() throws IOException {
            return content;
        }

        @Override
        public InputStream getInputStream() throws IOException {
            return new ByteArrayInputStream(content);
        }

        @Override
        public void transferTo(java.io.File dest) throws IOException, IllegalStateException {
            Files.write(dest.toPath(), content);
        }
    }
}
