namespace java com.tsinghua.thrift.api
namespace go tsinghua.api
namespace py tsinghua.api

// 通用数据类型 - 匹配您的Result DTO
struct Result {
    1: bool success,
    2: string message,
    3: optional string data,
}

// ========== 数据源相关 - 完全匹配您的StorageEngineInfoDto ==========
struct StorageEngineInfo {
    1: i64 id,
    2: optional string ip,
    3: i32 port,
    4: i32 type,
    5: optional string schemaPrefix,
    6: optional string dataPrefix,
}

// ========== 数据查询相关 - 完全匹配您的DataQueryRequest DTO ==========
struct DataQueryRequest {
    1: list<string> paths,
    2: optional i64 startTime,
    3: optional i64 endTime,
    4: optional i32 aggregateType,
    5: optional i64 precision,
    6: optional i32 timePrecision,
}

// 关系数据查询请求 - 完全匹配您的RelationalQueryRequest DTO
struct RelationalQueryRequest {
    1: i32 pageNum = 1,
    2: i32 pageSize = 10,
    3: optional string tableName,
    4: optional list<FilterCondition> filters,
    5: optional string sortField,
    6: optional string sortDirection,
}

// 筛选条件 - 完全匹配您的RelationalQueryRequest.FilterCondition
struct FilterCondition {
    1: string field,
    2: string operator,
    3: string value,
    4: optional string logicOperator,
    5: optional bool startGroup,
    6: optional bool endGroup,
}

// 表数据传输对象 - 完全匹配您的TableDto DTO
struct TableDto {
    1: optional list<string> header,
    2: optional list<map<string, string>> records,
}

// 输入绑定 - 匹配 InputBindDto
struct InputBindDto {
    1: string sourceField,
    2: string targetField,
    3: string operator,
    4: string conversionValue,
}

// 时间范围查询请求 - 匹配 TimeRangeRequest
struct TimeRangeRequest {
    1: string tableName,
    2: optional list<InputBindDto> inputsBind,
}

// 数据导入请求 - 匹配 DataImportRequest
struct DataImportRequest {
    1: string targetPath,
    2: optional string key,
    3: optional string description,
}

// ========== 数据集相关 ==========
struct DatasetRequest {
    1: string datasetName,
    2: list<string> datasetSql,
    3: optional i64 parent,
    4: optional string remark,
}

struct DatasetEntity {
    1: i64 id,
    2: string datasetName,
    3: string datasetSql,
    4: string version,
    5: string storagePath,
    6: i64 createTime,
    7: i64 parent,
    8: string operator,
    9: string clientIp,
    10: string remark,
    11: bool deleted,
}

// 数据集版本实体 - 匹配 DatasetVersionEntity
struct DatasetVersionEntity {
    1: i64 id,
    2: i64 datasetId,
    3: string datasetName,
    4: string versionNo,
    5: string provenanceType,
    6: string storagePath,
    7: optional string upstreamVersionIds,
    8: optional string derivationConfig,
    9: optional string schemaJson,
    10: optional i64 rowCount,
    11: optional i64 sizeBytes,
    12: i64 createTime,
    13: optional string operator,
    14: optional string clientIp,
    15: optional string remark,
    16: bool deleted,
    17: optional i32 jobState,
}

// 向导式创建数据集版本请求 - 匹配 DatasetCreateRequest
struct DatasetCreateRequest {
    1: string datasetName,
    2: string provenanceType,
    3: optional string sourcePath,
    4: optional string importFileName,
    5: optional string importFileBase64,
    6: optional string importKeyColumn,
    7: optional i64 sqlSnippetId,
    8: optional list<i64> upstreamVersionIds,
    9: optional list<string> udfNames,
    10: optional i64 transformCompareCreateTime,
    11: optional string description,
    12: optional string dataModality,
    13: optional string project,
    14: optional string remark,
}

// 数据集树 - 匹配 DatasetTreeDTO
struct DatasetTreeVersion {
    1: i64 versionId,
    2: string versionNo,
    3: optional string storagePath,
    4: optional string provenanceType,
    5: i64 createTime,
    6: bool deleted,
    7: optional i32 jobState,
}

struct DatasetTreeDTO {
    1: i64 datasetId,
    2: string datasetName,
    3: list<DatasetTreeVersion> versions,
}

// 数据集变化过程 - 匹配 DatasetChangeProcessDTO
struct UpstreamRef {
    1: i64 versionId,
    2: optional string datasetName,
    3: optional string versionNo,
    4: bool primary,
}

struct DatasetChangeProcessDTO {
    1: i64 versionId,
    2: string versionNo,
    3: optional string provenanceType,
    4: optional string provenanceLabel,
    5: optional string storagePath,
    6: optional list<UpstreamRef> upstreams,
    7: optional string derivationConfig,
    8: optional string operator,
    9: optional string clientIp,
    10: i64 createTime,
    11: optional string remark,
    12: optional i64 rowCount,
    13: optional i64 sizeBytes,
    14: bool deleted,
    15: optional i32 jobState,
}

// 血缘图谱 - 匹配 LineageGraphDTO
struct LineageNode {
    1: i64 versionId,
    2: optional i64 datasetId,
    3: string datasetName,
    4: string versionNo,
    5: optional string provenanceType,
    6: optional string provenanceLabel,
    7: optional string storagePath,
    8: optional string operator,
    9: optional string clientIp,
    10: i64 createTime,
    11: optional string remark,
    12: bool deleted,
    13: optional i32 jobState,
    14: bool focus,
    15: optional string derivationConfig,
}

struct LineageEdge {
    1: i64 fromVersion,
    2: i64 toVersion,
    3: optional string relationType,
    4: bool primary,
}

struct LineageGraphDTO {
    1: list<LineageNode> nodes,
    2: list<LineageEdge> edges,
    3: optional i64 focusVersionId,
}

struct DatasetVersionTreeDTO {
    1: string id,
    2: string name,
    3: string time,
    4: i64 timestamp,
    5: i64 parent,
    6: string color,
    7: string user,
    8: string ip,
    9: string sql,
    10: string remark,
    11: bool deleted,
    12: optional list<DatasetVersionTreeDTO> children,
}

// ========== 函数相关 ==========
struct RegisterTaskInfoDto {
    1: string name,
    2: string className,
    3: string fileName,
    4: string ipPortPair,
    5: string type,
}

// ========== Transform作业相关 ==========
struct TaskInfoDto {
    1: i32 taskType,
    2: i32 dataFlowType,
    3: optional i64 timeout,
    4: optional string dataset,
    5: optional i64 sqlSnippetId,
    6: optional string sqlSnippetName,
    7: optional string pyTaskName,
}

struct TransformJobRequest {
    1: optional i64 createTime,
    2: string name,
    3: list<TaskInfoDto> taskList,
    4: optional i32 exportType,
    5: optional string exportFile,
    6: optional string schedule,
    7: optional string owner,
}

struct TransformJobQueryRequest {
    1: optional i32 pageNum,
    2: optional i32 pageSize,
    3: optional string name,
    4: optional i32 jobState,
}

struct TransformCompareEntity {
    1: i64 id,
    2: string name,
    3: string taskList,
    4: optional i32 exportType,
    5: optional string exportFile,
    6: optional string schedule,
    7: i64 createTime,
    8: string operator,
    9: string clientIp,
    10: optional string owner,
}

struct TransformJobEntity {
    1: i64 id,
    2: string name,
    3: string taskList,
    4: string exportFiletName,
    5: optional string schedule,
    6: optional string jobId,
    7: i32 jobState,
    8: i64 createTime,
    9: string operator,
    10: string clientIp,
    11: optional string owner,
}

// ========== 用户相关 - 匹配 UserEntity ==========
struct UserEntity {
    1: string username,
    2: optional string password,
    3: string role,
    4: optional i64 roleId,
    5: bool enabled,
    6: optional i64 timestamp,
}

// 用户查询请求 - 匹配 UserQueryRequest
struct UserQueryRequest {
    1: optional i32 page,
    2: optional i32 pageSize,
    3: optional string username,
    4: optional string role,
    5: optional string enabled,
}

// 登录请求
struct LoginRequest {
    1: string username,
    2: string password,
}

// 刷新Token请求
struct RefreshTokenRequest {
    1: string refreshToken,
}

// 修改密码请求
struct ChangePasswordRequest {
    1: string username,
    2: string oldPassword,
    3: string newPassword,
}

// ========== 数据权限相关 ==========
struct DataPermissionQueryRequest {
    1: optional i32 page,
    2: optional i32 pageSize,
    3: optional string tablePrefix,
}

struct DataPermissionUpdateRequest {
    1: i64 id,
    2: optional bool isPublic,
    3: optional string visibleUsers,
}

// ========== 质量评价相关 ==========
struct DataQualityDimension {
    1: optional double weight,
    2: optional string transformId,
    3: optional string jobId,
    4: optional string name,
    5: optional string exportFile,
    6: optional double score,
}

struct EvaluationCriteriaRequest {
    1: optional i64 id,
    2: string name,
    3: optional string description,
    4: optional DataQualityDimension qcom,
    5: optional DataQualityDimension qcon,
    6: optional DataQualityDimension qtim,
    7: optional DataQualityDimension qval,
    8: optional string owner,
}

struct EvaluationCriteriaQueryRequest {
    1: optional i32 pageNum = 1,
    2: optional i32 pageSize = 100,
    3: optional string name,
}

struct EvaluationCriteriaEntity {
    1: i64 id,
    2: string name,
    3: optional string description,
    4: optional string weights,
    5: optional string jobs,
    6: optional string exportFiles,
    7: optional string names,
    8: optional i64 createTime,
    9: optional string operator,
    10: optional string clientIp,
    11: optional string owner,
}

struct QualityAssessmentRequest {
    1: optional i64 id,
    2: optional i64 criteriaId,
    3: optional string criteriaName,
    4: optional string description,
    5: optional DataQualityDimension qcom,
    6: optional DataQualityDimension qcon,
    7: optional DataQualityDimension qtim,
    8: optional DataQualityDimension qval,
    9: optional string dqi,
    10: optional string passed,
    11: optional string owner,
}

struct QualityAssessmentQueryRequest {
    1: optional i32 pageNum = 1,
    2: optional i32 pageSize = 100,
    3: optional string criteriaName,
}

struct QualityAssessmentEntity {
    1: i64 id,
    2: optional i64 criteriaId,
    3: optional string criteriaName,
    4: optional string description,
    5: optional string weights,
    6: optional string jobs,
    7: optional string exportFiles,
    8: optional string names,
    9: optional string jobIds,
    10: optional string scores,
    11: optional string dqi,
    12: optional string passed,
    13: optional i64 createTime,
    14: optional string operator,
    15: optional string clientIp,
    16: optional string owner,
}

// ========== API服务接口 - 匹配所有Controller的方法 ==========
service ApiService {
    // ========== 数据源接口 - 匹配DataSourceController ==========
    // POST /api/datasource/register -> register(String jsonBody)
    Result registerDataSource(1: string jsonBody),
    
    // POST /api/datasource/remove -> remove(StorageEngineInfoDto)
    Result removeDataSource(1: StorageEngineInfo storageEngineInfo),
    
    // GET /api/datasource/list -> list()
    Result listDataSources(),
    
    // GET /api/datasource/tree -> tree()
    Result getDataSourceTree(),

    // ========== 数据查询接口 - 匹配DataTableController ==========
    // POST /api/data/query -> queryData(DataQueryRequest)
    Result queryData(1: DataQueryRequest request),
    
    // POST /api/data/fs/query -> queryFileData(DataQueryRequest)
    Result queryFileData(1: DataQueryRequest request),
    
    // POST /api/data/import -> importData(DataImportRequest, MultipartFile)
    Result importData(1: DataImportRequest config, 2: binary file),
    
    // POST /api/data/export -> exportData(DataQueryRequest)
    binary exportData(1: DataQueryRequest request),
    
    // POST /api/data/delete -> deleteData(DataQueryRequest)
    Result deleteData(1: DataQueryRequest request),
    
    // POST /api/data/time-range -> getTimeRange(TimeRangeRequest)
    Result getTimeRange(1: TimeRangeRequest request),
    
    // POST /api/data/relational/query -> queryData(RelationalQueryRequest)
    Result queryRelationalData(1: RelationalQueryRequest request),
    
    // POST /api/data/relational/count -> countData(RelationalQueryRequest)
    Result countRelationalData(1: RelationalQueryRequest request),
    
    // POST /api/data/relational/export -> exportRelationalDataToExcel(RelationalQueryRequest)
    binary exportRelationalDataToExcel(1: RelationalQueryRequest request),

    // ========== 数据集接口 - 匹配DatasetController ==========
    // POST /api/dataset/testsql -> testSQL(String sql)
    Result testSQL(1: string sql),
    
    // POST /api/dataset/save -> saveDataset(DatasetRequest)
    Result saveDataset(1: DatasetRequest request),
    
    // GET /api/dataset/metas -> queryMeta(String path)
    Result queryMeta(1: string path),
    
    // DELETE /api/dataset/delete -> deleteDataset(String path)
    Result deleteDataset(1: string path),
    
    // POST /api/dataset/create -> create(DatasetCreateRequest)
    Result createDataset(1: DatasetCreateRequest request),
    
    // GET /api/dataset/tree -> tree()
    Result getDatasetTree(),
    
    // GET /api/dataset/version/metas -> versionMeta(versionId)
    Result getDatasetVersionMeta(1: i64 versionId),
    
    // GET /api/dataset/changes -> changes(datasetId)
    Result getDatasetChanges(1: i64 datasetId),
    
    // GET /api/dataset/lineage -> lineage(versionId, sideLineage)
    Result getDatasetLineage(1: i64 versionId, 2: bool sideLineage),
    
    // DELETE /api/dataset/version/delete -> deleteVersion(versionId)
    Result deleteDatasetVersion(1: i64 versionId),

    // ========== 函数接口 - 匹配FunctionController ==========
    // POST /api/function/register/transform -> registerTransform(MultipartFile, name, className)
    Result registerTransform(1: binary file, 2: string name, 3: string className),
    
    // DELETE /api/function/delete/{name} -> handleDelete(String name)
    Result deleteFunction(1: string name),
    
    // GET /api/function/query/{type} -> list(String type)
    Result listFunctions(1: string type),
    
    // POST /api/function/register/udf -> registerUDF(MultipartFile, name, className, udfType)
    Result registerUDF(1: binary file, 2: string name, 3: string className, 4: string udfType),
    
    // GET /api/function/download/{type}/{fileName} -> downloadFunction(type, fileName)
    binary downloadFunction(1: string type, 2: string fileName),

    // ========== Transform作业编排接口 - 匹配TransformCompareController ==========
    // POST /api/transform-compare/save -> saveTransform(TransformJobRequest)
    Result saveTransformCompare(1: TransformJobRequest request),
    
    // POST /api/transform-compare/query -> queryJobs(TransformJobQueryRequest)
    Result queryTransformCompares(1: TransformJobQueryRequest request),
    
    // POST /api/transform-compare/count -> countJobs(TransformJobQueryRequest)
    Result countTransformCompares(1: TransformJobQueryRequest request),
    
    // GET /api/transform-compare/detail -> queryJob(Long createTime)
    Result getTransformCompare(1: i64 createTime),
    
    // DELETE /api/transform-compare/delete -> deleteJob(Long createTime)
    Result deleteTransformCompare(1: i64 createTime),

    // ========== Transform任务管理接口 - 匹配TransformJobController ==========
    // POST /api/transform-job/query -> queryJobs(TransformJobQueryRequest)
    Result queryTransformJobs(1: TransformJobQueryRequest request),
    
    // POST /api/transform-job/count -> countJobs(TransformJobQueryRequest)
    Result countTransformJobs(1: TransformJobQueryRequest request),
    
    // GET /api/transform-job/detail/{jobId} -> queryJob(String jobId)
    Result getTransformJob(1: string jobId),
    
    // PUT /api/transform-job/commit/{createTime} -> commitJob(Long createTime)
    Result commitTransformJob(1: i64 createTime),
    
    // GET /api/transform-job/status/{jobId} -> statusJob(String jobId)
    Result getTransformJobStatus(1: string jobId),
    
    // PUT /api/transform-job/cancel/{jobId} -> cancelJob(String jobId)
    Result cancelTransformJob(1: string jobId),
    
    // GET /api/transform-job/bloodline -> chartBloodline(String datasetPath, Boolean sideLineage)
    Result getTransformJobBloodline(1: string datasetPath, 2: bool sideLineage),

    // ========== 文档接口 - 匹配DocController ==========
    // GET /api/doc/user-manual/file -> getUserManualFile()
    binary getUserManualFile(),

    // ========== API代码生成接口 - 匹配ApiGenerationController ==========
    // POST /api/generation/java -> generateJavaCode()
    Result generateJavaCode(),
    
    // POST /api/generation/go -> generateGoCode()
    Result generateGoCode(),
    
    // POST /api/generation/python -> generatePythonCode()
    Result generatePythonCode(),
    
    // POST /api/generation/restful -> generateRestfulApiCode()
    Result generateRestfulApiCode(),
    
    // POST /api/generation/all -> generateAllCode()
    Result generateAllCode(),
    
    // GET /api/generation/status -> getGenerationStatus()
    Result getGenerationStatus(),
    
    // GET /api/generation/validate -> validateThriftFile()
    Result validateThriftFile(),

    // ========== 认证接口 - 匹配AuthController ==========
    // POST /api/auth/login -> login(Map<String, String>)
    Result login(1: LoginRequest request),
    
    // POST /api/auth/refresh -> refreshToken(Map<String, String>)
    Result refreshToken(1: RefreshTokenRequest request),
    
    // GET /api/auth/verify -> verifyToken()
    Result verifyToken(),
    
    // POST /api/auth/logout -> logout()
    Result logout(),
    
    // GET /api/auth/user -> getCurrentUser()
    Result getCurrentAuthUser(),

    // ========== 用户管理接口 - 匹配UserController ==========
    // POST /api/user/save -> saveUser(UserEntity)
    Result saveUser(1: UserEntity user),
    
    // POST /api/user/query -> queryUsers(UserQueryRequest)
    Result queryUsers(1: UserQueryRequest request),
    
    // POST /api/user/count -> countUsers(UserQueryRequest)
    Result countUsers(1: UserQueryRequest request),
    
    // GET /api/user/all -> allUsers()
    Result allUsers(),
    
    // GET /api/user/detail -> queryUser(String username)
    Result queryUser(1: string username),
    
    // DELETE /api/user/delete -> deleteUser(String username)
    Result deleteUser(1: string username),
    
    // POST /api/user/update -> updateUser(UserEntity)
    Result updateUser(1: UserEntity user),
    
    // GET /api/user/roles -> getRoles()
    Result getRoles(),
    
    // POST /api/user/change-password -> changePassword(Map<String, String>)
    Result changePassword(1: ChangePasswordRequest request),
    
    // GET /api/user/current -> getCurrentUser()
    Result getCurrentUser(),

    // ========== 数据权限接口 - 匹配DataPermissionController ==========
    // GET /api/data-permission/owner-tables -> listOwnerTables()
    Result listOwnerTables(),
    
    // POST /api/data-permission/query -> query(DataPermissionQueryRequest)
    Result queryDataPermissions(1: DataPermissionQueryRequest request),
    
    // POST /api/data-permission/count -> count(DataPermissionQueryRequest)
    Result countDataPermissions(1: DataPermissionQueryRequest request),
    
    // POST /api/data-permission/update -> update(DataPermissionUpdateRequest)
    Result updateDataPermission(1: DataPermissionUpdateRequest request),

    // ========== 评价准则接口 - 匹配EvaluationCriteriaController ==========
    // POST /api/evaluation-criteria/save -> saveCriteria(EvaluationCriteriaRequest)
    Result saveEvaluationCriteria(1: EvaluationCriteriaRequest request),
    
    // POST /api/evaluation-criteria/query -> queryCriteria(EvaluationCriteriaQueryRequest)
    Result queryEvaluationCriteria(1: EvaluationCriteriaQueryRequest request),
    
    // POST /api/evaluation-criteria/count -> countCriteria(EvaluationCriteriaQueryRequest)
    Result countEvaluationCriteria(1: EvaluationCriteriaQueryRequest request),
    
    // GET /api/evaluation-criteria/detail -> queryById(Long id)
    Result getEvaluationCriteria(1: i64 id),
    
    // DELETE /api/evaluation-criteria/delete -> deleteCriteria(Long id)
    Result deleteEvaluationCriteria(1: i64 id),

    // ========== 质量测评接口 - 匹配QualityAssessmentController ==========
    // POST /api/quality-assessment/save -> saveAssessment(QualityAssessmentRequest)
    Result saveQualityAssessment(1: QualityAssessmentRequest request),
    
    // POST /api/quality-assessment/query -> queryAssessments(QualityAssessmentQueryRequest)
    Result queryQualityAssessments(1: QualityAssessmentQueryRequest request),
    
    // POST /api/quality-assessment/count -> countAssessments(QualityAssessmentQueryRequest)
    Result countQualityAssessments(1: QualityAssessmentQueryRequest request),
    
    // GET /api/quality-assessment/detail -> queryById(Long id)
    Result getQualityAssessment(1: i64 id),
    
    // DELETE /api/quality-assessment/delete -> deleteAssessment(Long id)
    Result deleteQualityAssessment(1: i64 id),
}
