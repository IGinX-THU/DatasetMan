# DatasetMan Python SDK

DatasetMan Python SDK 提供了用于访问 DatasetMan 服务的 Thrift 客户端。

## 安装

### pip

```bash
pip install datasetman-sdk-python
```

或从源码安装：

```bash
cd datasetman-sdk-python
pip install -e .
```

## 使用方法

### 创建 Thrift 客户端

```python
from thrift import Thrift
from thrift.transport import TSocket
from thrift.transport import TTransport
from thrift.protocol import TBinaryProtocol
from tsinghua.api import ApiService

def main():
    try:
        # 创建传输
        transport = TSocket.TSocket('localhost', 9090)
        transport = TTransport.TBufferedTransport(transport)
        
        # 创建协议
        protocol = TBinaryProtocol.TBinaryProtocol(transport)
        
        # 创建客户端
        client = ApiService.Client(protocol)
        
        # 打开传输
        transport.open()
        
        # 使用客户端调用 API 方法
        # 示例：列出数据源
        result = client.listDataSources()
        if result.success:
            print("数据源:", result.data)
        else:
            print("错误:", result.message)
        
        # 关闭传输
        transport.close()
        
    except Thrift.TException as tx:
        print("Thrift 异常:", tx.message)

if __name__ == '__main__':
    main()
```

### API 方法

SDK 提供以下 API 方法：

#### 数据源操作
- `registerDataSource(jsonBody)` - 注册新数据源
- `removeDataSource(storageEngineInfo)` - 删除数据源
- `listDataSources()` - 列出所有数据源
- `getDataSourceTree()` - 获取数据源树结构

#### 数据查询操作
- `queryData(request)` - 查询时序数据
- `queryFileData(request)` - 查询文件数据
- `deleteData(request)` - 删除数据
- `queryRelationalData(request)` - 查询关系型数据
- `countRelationalData(request)` - 统计关系型数据

#### 数据集操作
- `testSQL(sql)` - 测试 SQL 查询
- `saveDataset(request)` - 保存数据集
- `queryMeta(path)` - 查询数据集元数据
- `deleteDataset(path)` - 删除数据集
- `getVersionHistory(datasetName)` - 获取数据集版本历史

#### 函数操作
- `deleteFunction(name)` - 删除函数
- `listFunctions(type)` - 按类型列出函数

#### Transform 对比操作
- `saveTransformCompare(request)` - 保存 Transform 对比作业
- `queryTransformCompares(request)` - 查询 Transform 对比作业
- `countTransformCompares(request)` - 统计 Transform 对比作业
- `getTransformCompare(createTime)` - 获取 Transform 对比作业详情
- `deleteTransformCompare(createTime)` - 删除 Transform 对比作业

#### Transform 作业操作
- `queryTransformJobs(request)` - 查询 Transform 作业
- `countTransformJobs(request)` - 统计 Transform 作业
- `getTransformJob(jobId)` - 获取 Transform 作业详情
- `commitTransformJob(createTime)` - 提交 Transform 作业
- `getTransformJobStatus(jobId)` - 获取 Transform 作业状态
- `cancelTransformJob(jobId)` - 取消 Transform 作业
- `getTransformJobBloodline(datasetPath, sideLineage)` - 获取 Transform 作业血缘

## 示例

```python
from thrift import Thrift
from thrift.transport import TSocket
from thrift.transport import TTransport
from thrift.protocol import TBinaryProtocol
from tsinghua.api import ApiService
from tsinghua.api.ttypes import Result

def main():
    try:
        # 创建传输
        transport = TSocket.TSocket('localhost', 9090)
        transport = TTransport.TBufferedTransport(transport)
        
        # 创建协议
        protocol = TBinaryProtocol.TBinaryProtocol(transport)
        
        # 创建客户端
        client = ApiService.Client(protocol)
        
        # 打开传输
        transport.open()
        
        # 列出数据源
        result = client.listDataSources()
        if result.success:
            print("数据源:", result.data)
        else:
            print("错误:", result.message)
        
        # 关闭传输
        transport.close()
        
    except Thrift.TException as tx:
        print("Thrift 异常:", tx.message)

if __name__ == '__main__':
    main()
```

## 连接配置

默认情况下，Thrift 服务器运行在 `localhost:9090`。您可以配置连接：

```python
# 自定义主机和端口
transport = TSocket.TSocket('your-host', your-port)

# 设置超时
transport = TSocket.TSocket('localhost', 9090)
transport.setTimeout(5000)  # 5 秒
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
# 安装依赖
pip install thrift

# 运行测试
python -m pytest tests/
```

## 系统要求

- Python 3.6 或更高版本
- thrift 0.13.0 或更高版本

## 许可证

请参阅 LICENSE 文件了解详情。
