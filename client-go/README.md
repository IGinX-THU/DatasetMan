# DatasetMan Go SDK

DatasetMan Go SDK 提供了用于访问 DatasetMan 服务的 Thrift 客户端。

## 安装

### Go Modules

```bash
go get github.com/IGinX-THU/DatasetMan/datasetman-sdk-go/tsinghua/api
```

或在 `go.mod` 中添加：

```go
require github.com/IGinX-THU/DatasetMan/datasetman-sdk-go/tsinghua/api v1.0.0
```

## 使用方法

### 创建 Thrift 客户端

```go
package main

import (
    "fmt"
    "git.apache.org/thrift.git/lib/go/thrift"
    "github.com/IGinX-THU/DatasetMan/datasetman-sdk-go/tsinghua/api"
)

func main() {
    transport, err := thrift.NewTSocket("localhost:9090")
    if err != nil {
        fmt.Println("打开 socket 错误:", err)
        return
    }
    defer transport.Close()
    
    protocol := thrift.NewTBinaryProtocolFactoryDefault().GetProtocol(transport)
    client := api.NewApiServiceClientFactory(protocol)
    
    if err := transport.Open(); err != nil {
        fmt.Println("打开传输错误:", err)
        return
    }
    
    // 使用客户端调用 API 方法
    // 示例：列出数据源
    result, err := client.ListDataSources()
    if err != nil {
        fmt.Println("错误:", err)
        return
    }
    
    fmt.Println("成功:", result.Success)
    fmt.Println("消息:", result.Message)
    fmt.Println("数据:", result.Data)
}
```

### API 方法

SDK 提供以下 API 方法：

#### 数据源操作
- `RegisterDataSource(jsonBody string)` - 注册新数据源
- `RemoveDataSource(storageEngineInfo *StorageEngineInfo)` - 删除数据源
- `ListDataSources()` - 列出所有数据源
- `GetDataSourceTree()` - 获取数据源树结构

#### 数据查询操作
- `QueryData(request *DataQueryRequest)` - 查询时序数据
- `QueryFileData(request *DataQueryRequest)` - 查询文件数据
- `DeleteData(request *DataQueryRequest)` - 删除数据
- `QueryRelationalData(request *RelationalQueryRequest)` - 查询关系型数据
- `CountRelationalData(request *RelationalQueryRequest)` - 统计关系型数据

#### 数据集操作
- `TestSQL(sql string)` - 测试 SQL 查询
- `SaveDataset(request *DatasetRequest)` - 保存数据集
- `QueryMeta(path string)` - 查询数据集元数据
- `DeleteDataset(path string)` - 删除数据集
- `GetVersionHistory(datasetName string)` - 获取数据集版本历史

#### 函数操作
- `DeleteFunction(name string)` - 删除函数
- `ListFunctions(type string)` - 按类型列出函数

#### Transform 对比操作
- `SaveTransformCompare(request *TransformJobRequest)` - 保存 Transform 对比作业
- `QueryTransformCompares(request *TransformJobQueryRequest)` - 查询 Transform 对比作业
- `CountTransformCompares(request *TransformJobQueryRequest)` - 统计 Transform 对比作业
- `GetTransformCompare(createTime int64)` - 获取 Transform 对比作业详情
- `DeleteTransformCompare(createTime int64)` - 删除 Transform 对比作业

#### Transform 作业操作
- `QueryTransformJobs(request *TransformJobQueryRequest)` - 查询 Transform 作业
- `CountTransformJobs(request *TransformJobQueryRequest)` - 统计 Transform 作业
- `GetTransformJob(jobId string)` - 获取 Transform 作业详情
- `CommitTransformJob(createTime int64)` - 提交 Transform 作业
- `GetTransformJobStatus(jobId string)` - 获取 Transform 作业状态
- `CancelTransformJob(jobId string)` - 取消 Transform 作业
- `GetTransformJobBloodline(datasetPath string, sideLineage bool)` - 获取 Transform 作业血缘

## 示例

```go
package main

import (
    "fmt"
    "git.apache.org/thrift.git/lib/go/thrift"
    "github.com/IGinX-THU/DatasetMan/datasetman-sdk-go/tsinghua/api"
)

func main() {
    transport, err := thrift.NewTSocket("localhost:9090")
    if err != nil {
        fmt.Println("打开 socket 错误:", err)
        return
    }
    defer transport.Close()
    
    protocol := thrift.NewTBinaryProtocolFactoryDefault().GetProtocol(transport)
    client := api.NewApiServiceClientFactory(protocol)
    
    if err := transport.Open(); err != nil {
        fmt.Println("打开传输错误:", err)
        return
    }
    
    // 列出数据源
    result, err := client.ListDataSources()
    if err != nil {
        fmt.Println("错误:", err)
        return
    }
    
    if result.Success {
        fmt.Println("数据源:", result.Data)
    } else {
        fmt.Println("错误:", result.Message)
    }
}
```

## 连接配置

默认情况下，Thrift 服务器运行在 `localhost:9090`。您可以配置连接：

```go
// 自定义主机和端口
transport, err := thrift.NewTSocket("your-host:your-port")

// 设置超时
transportFactory := thrift.NewTTransportFactory()
transportFactory.SetTimeout(5000) // 5 秒
transport := transportFactory.GetTransport(thrift.NewTSocket("localhost:9090"))
```

## 数据类型

SDK 使用以下 Thrift 数据类型：

- `Result` - 通用结果包装器，包含 Success、Message 和 Data 字段
- `StorageEngineInfo` - 数据源信息
- `DataQueryRequest` - 时序数据查询请求
- `RelationalQueryRequest` - 关系型数据查询请求
- `DatasetRequest` - 数据集创建/更新请求
- `TransformJobRequest` - Transform 作业请求
- 以及更多...

## 从源码构建

```bash
# 构建 SDK
go build ./tsinghua/api

# 运行测试
go test ./tsinghua/api
```

## 系统要求

- Go 1.16 或更高版本
- Apache Thrift 0.22.0

## 许可证

请参阅 LICENSE 文件了解详情。
