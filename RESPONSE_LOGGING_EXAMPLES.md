# 响应日志记录功能使用示例

## 快速开始

### 1. 启用响应日志记录

```bash
# 启用请求响应日志记录
export MDB_MCP_REQUEST_LOGGING_ENABLED=true
export MDB_MCP_REQUEST_LOGGING_RETENTION_DAYS=7
export MDB_MCP_REQUEST_LOGGING_INCLUDE_HEADERS=true
export MDB_MCP_REQUEST_LOGGING_INCLUDE_BODY=true

# 启动MCP服务器
node dist/index.js
```

### 2. 查看日志统计

```bash
# 查看请求响应统计信息
npm run logs:request:stats
```

输出示例：
```
📊 请求响应日志统计信息:
────────────────────────────────────────────────────────────
📁 请求文件数: 25 (125.34 KB)
📁 响应文件数: 23 (87.21 KB)
📊 总请求数: 25
📊 总响应数: 23
💾 总大小: 212.55 KB

🔧 请求方法统计:
  tools/call: 20
  tools/list: 3
  resources/list: 2

📅 按日期统计:
  2024-12-28: 15
  2024-12-27: 10

⏱️ 执行时间统计:
  平均执行时间: 156.43ms
  最大执行时间: 1250ms
  最小执行时间: 15ms
```

### 3. 查看最近的请求响应对

```bash
# 查看最近5个请求响应对
npm run logs:request:recent
```

输出示例：
```
📋 最近 5 个请求响应对:
────────────────────────────────────────────────────────────────────────────────
🕐 2024/12/28 下午2:30:25
🆔 请求ID: abc12345def67890
🔧 方法: tools/call
🖥️ 客户端: vscode-mcp@1.0.0
✅ 响应状态: ✅ 成功
⏱️ 执行时间: 234ms
📦 请求体: {"jsonrpc":"2.0","id":"request-1","method":"tools/call","params":{"name":"find","arguments":{"collection":"users","filter":{"status":"active"}}}}...
────────────────────────────────────────────────────────────────────────────────
```

### 4. 查看特定请求的完整信息

```bash
# 查看特定请求ID的完整请求-响应对
npm run logs:request:pair abc12345def67890
```

输出示例：
```
📋 请求-响应详情:
────────────────────────────────────────────────────────────────────────────────
📤 请求信息:
{
  "timestamp": "2024-12-28T14:30:25.123Z",
  "requestId": "abc12345def67890",
  "method": "tools/call",
  "headers": {
    "transport": "StdioServerTransport",
    "timestamp": "2024-12-28T14:30:25.123Z",
    "sessionId": "session123"
  },
  "body": {
    "jsonrpc": "2.0",
    "id": "request-1",
    "method": "tools/call",
    "params": {
      "name": "find",
      "arguments": {
        "collection": "users",
        "filter": { "status": "active" }
      }
    }
  },
  "clientInfo": {
    "name": "vscode-mcp",
    "version": "1.0.0"
  }
}
────────────────────────────────────────────────────────────
📥 响应信息:
{
  "timestamp": "2024-12-28T14:30:25.234Z",
  "requestId": "abc12345def67890",
  "responseData": {
    "jsonrpc": "2.0",
    "id": "request-1",
    "result": {
      "content": [
        {
          "type": "text",
          "text": "[{\"_id\": \"user1\", \"name\": \"John\", \"status\": \"active\"}]"
        }
      ]
    }
  },
  "executionTimeMs": 234
}
```

### 5. 搜索特定内容

```bash
# 搜索包含错误的请求或响应
npm run logs:request:search "error"

# 搜索特定工具调用
npm run logs:request:search "find"

# 搜索特定状态
npm run logs:request:search "INVALID_PARAMS"
```

输出示例：
```
🔍 找到 3 个匹配的日志:
────────────────────────────────────────────────────────────────────────────────
📥 response - response_2024-12-28_14-31-02_def67890.json
🕐 2024/12/28 下午2:31:02
🆔 请求ID: def67890abc12345
⏱️ 执行时间: 15ms
────────────────────────────────────────────────────────────
```

## 常见使用场景

### 性能调试

1. 查看执行时间分布：
```bash
npm run logs:request:stats
```

2. 查找慢查询：
```bash
npm run logs:request:search "executionTimeMs"
```

### 错误分析

1. 查找所有错误响应：
```bash
npm run logs:request:search "error"
```

2. 分析特定错误：
```bash
npm run logs:request:search "INVALID_PARAMS"
```

### 功能使用分析

1. 查看最常用的工具：
```bash
npm run logs:request:stats  # 查看方法统计
```

2. 查看特定工具的使用情况：
```bash
npm run logs:request:search "find"
npm run logs:request:search "aggregate"
```

### 清理旧日志

```bash
# 清理7天前的日志
npm run logs:request:cleanup

# 清理3天前的日志
npm run logs:request cleanup 3
```

## 测试功能

运行测试以验证响应日志记录功能：

```bash
npm run test:response-logging
```

这将创建模拟的请求响应日志文件，测试读取、关联和验证功能。

## 配置选项

### 生产环境（最小日志）
```bash
export MDB_MCP_REQUEST_LOGGING_ENABLED=true
export MDB_MCP_REQUEST_LOGGING_RETENTION_DAYS=3
export MDB_MCP_REQUEST_LOGGING_INCLUDE_HEADERS=false
export MDB_MCP_REQUEST_LOGGING_INCLUDE_BODY=false
```

### 开发环境（完整日志）
```bash
export MDB_MCP_REQUEST_LOGGING_ENABLED=true
export MDB_MCP_REQUEST_LOGGING_RETENTION_DAYS=7
export MDB_MCP_REQUEST_LOGGING_INCLUDE_HEADERS=true
export MDB_MCP_REQUEST_LOGGING_INCLUDE_BODY=true
export MDB_MCP_LOG_LEVEL=debug
``` 