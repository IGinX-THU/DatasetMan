# DatasetMan Java SDK

DatasetMan Java SDK 提供了用于访问 DatasetMan 服务的 Thrift 客户端。

## 安装

### Maven

在 `pom.xml` 中添加以下依赖：

```xml
<dependency>
    <groupId>com.tsinghua</groupId>
    <artifactId>datasetman-sdk-java</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

在 `build.gradle` 中添加以下依赖：

```gradle
implementation 'com.tsinghua:datasetman-sdk-java:1.0.0'
```

## 使用方法

### 创建 Thrift 客户端

```java
import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.transport.TSocket;
import org.apache.thrift.transport.TTransport;
import com.tsinghua.thrift.api.ApiService;

public class DatasetManClient {
    public static void main(String[] args) {
        TTransport transport = new TSocket("localhost", 9090);
        try {
            transport.open();
            
            TProtocol protocol = new TBinaryProtocol(transport);
            ApiService.Client client = new ApiService.Client(protocol);
            
            // 使用客户端调用 API 方法
            // 示例：注册数据源
            // Result result = client.registerDataSource(jsonBody);
            
            transport.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

### API 方法

SDK 提供以下 API 方法：

#### 数据源操作
- `registerDataSource(String jsonBody)` - 注册新数据源
- `removeDataSource(StorageEngineInfo storageEngineInfo)` - 删除数据源
- `listDataSources()` - 列出所有数据源
- `getDataSourceTree()` - 获取数据源树结构

#### 数据查询操作
- `queryData(DataQueryRequest request)` - 查询时序数据
- `queryFileData(DataQueryRequest request)` - 查询文件数据
- `deleteData(DataQueryRequest request)` - 删除数据
- `queryRelationalData(RelationalQueryRequest request)` - 查询关系型数据
- `countRelationalData(RelationalQueryRequest request)` - 统计关系型数据

#### 数据集操作
- `testSQL(String sql)` - 测试 SQL 查询
- `saveDataset(DatasetRequest request)` - 保存数据集
- `queryMeta(String path)` - 查询数据集元数据
- `deleteDataset(String path)` - 删除数据集
- `getVersionHistory(String datasetName)` - 获取数据集版本历史

#### 函数操作
- `deleteFunction(String name)` - 删除函数
- `listFunctions(String type)` - 按类型列出函数

#### Transform 对比操作
- `saveTransformCompare(TransformJobRequest request)` - 保存 Transform 对比作业
- `queryTransformCompares(TransformJobQueryRequest request)` - 查询 Transform 对比作业
- `countTransformCompares(TransformJobQueryRequest request)` - 统计 Transform 对比作业
- `getTransformCompare(long createTime)` - 获取 Transform 对比作业详情
- `deleteTransformCompare(long createTime)` - 删除 Transform 对比作业

#### Transform 作业操作
- `queryTransformJobs(TransformJobQueryRequest request)` - 查询 Transform 作业
- `countTransformJobs(TransformJobQueryRequest request)` - 统计 Transform 作业
- `getTransformJob(String jobId)` - 获取 Transform 作业详情
- `commitTransformJob(long createTime)` - 提交 Transform 作业
- `getTransformJobStatus(String jobId)` - 获取 Transform 作业状态
- `cancelTransformJob(String jobId)` - 取消 Transform 作业
- `getTransformJobBloodline(String datasetPath, boolean sideLineage)` - 获取 Transform 作业血缘

## 示例

```java
import com.tsinghua.thrift.api.*;
import org.apache.thrift.TException;

public class Example {
    public static void main(String[] args) {
        TTransport transport = new TSocket("localhost", 9090);
        try {
            transport.open();
            
            TProtocol protocol = new TBinaryProtocol(transport);
            ApiService.Client client = new ApiService.Client(protocol);
            
            // 列出数据源
            Result result = client.listDataSources();
            if (result.isSuccess()) {
                System.out.println("数据源: " + result.getData());
            } else {
                System.out.println("错误: " + result.getMessage());
            }
            
            transport.close();
        } catch (TException e) {
            e.printStackTrace();
        }
    }
}
```

## 连接配置

默认情况下，Thrift 服务器运行在 `localhost:9090`。您可以配置连接：

```java
// 自定义主机和端口
TTransport transport = new TSocket("your-host", your-port);

// 设置超时
TSocket socket = new TSocket("localhost", 9090);
socket.setTimeout(5000); // 5 秒超时
TTransport transport = socket;
```

## 数据类型

SDK 使用以下 Thrift 数据类型：

- `Result` - 通用结果包装器，包含 success、message 和 data 字段
- `StorageEngineInfo` - 数据源信息
- `DataQueryRequest` - 时序数据查询请求
- `RelationalQueryRequest` - 关系型数据查询请求
- `DatasetRequest` - 数据集创建/更新请求
- `TransformJobRequest` - Transform 作业请求
- 以及更多...

## 从源码构建

```bash
# 构建 SDK
mvn clean install

# 跳过测试
mvn clean install -DskipTests
```

## 系统要求

- Java 8 或更高版本
- Maven 3.6 或更高版本
- Apache Thrift 0.22.0

## 许可证

请参阅 LICENSE 文件了解详情。
