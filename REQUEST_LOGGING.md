# MongoDB MCP 服务器请求日志记录

## 功能概述

MCP服务器现在支持记录所有收到的请求，包括请求头和请求体，用于调试和分析客户端行为。

## 配置选项

### 环境变量配置

```bash
# 启用/禁用请求日志记录
export MDB_MCP_REQUEST_LOGGING_ENABLED=true

# 设置日志保留天数
export MDB_MCP_REQUEST_LOGGING_RETENTION_DAYS=7

# 是否包含请求头
export MDB_MCP_REQUEST_LOGGING_INCLUDE_HEADERS=true

# 是否包含请求体
export MDB_MCP_REQUEST_LOGGING_INCLUDE_BODY=true
```

### 默认配置

```javascript
requestLogging: {
    enabled: true,           // 启用请求日志
    retentionDays: 7,       // 保留7天
    includeHeaders: true,   // 包含请求头
    includeBody: true,      // 包含请求体
}
```

## 日志文件格式

请求日志文件存储在：
- Windows: `%LOCALAPPDATA%\mongodb\mongodb-mcp\.app-logs\requests\`
- macOS/Linux: `~/.mongodb/mongodb-mcp/.app-logs/requests/`

### 文件命名规则

```
request_YYYY-MM-DD_HH-MM-SS_请求ID前8位.json
```

例如：`request_2024-12-28_14-30-25_abc12345.json`

### 日志内容示例

```json
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
  },
  "loggedAt": "2024-12-28T14:30:25.150Z",
  "config": {
    "includeHeaders": true,
    "includeBody": true
  }
}
```

## 隐私和安全

### 敏感信息处理

系统会自动移除或替换敏感信息：

**请求头中的敏感字段：**
- `authorization`
- `cookie`
- `x-api-key`
- `bearer`
- `token`

**请求体中的敏感字段：**
- `password`
- `token`
- `secret`
- `key`
- `auth`
- `connectionstring`

所有敏感字段会被替换为 `[REDACTED]`。

## 日志管理

### 查看日志

```bash
# 查看统计信息
npm run logs:request:stats

# 查看最近的请求
npm run logs:request:recent

# 查看最近10个请求
npm run logs:request recent 10

# 搜索特定内容
npm run logs:request search "find"

# 显示帮助
npm run logs:request help
```

### 手动清理日志

```bash
# 清理7天前的日志
npm run logs:request:cleanup

# 清理3天前的日志
npm run logs:request cleanup 3
```

### 自动清理

服务器启动后会自动：
1. 立即执行一次日志清理
2. 每24小时清理一次过期日志
3. 根据配置的 `retentionDays` 删除过期文件

## 使用脚本直接管理

```bash
# 直接使用脚本
node scripts/view-request-logs.js stats
node scripts/view-request-logs.js recent 5
node scripts/view-request-logs.js search "aggregate"
node scripts/view-request-logs.js cleanup 7

# 指定日志目录
node scripts/view-request-logs.js stats --log-dir /path/to/logs
```

## 性能考虑

### 启用请求日志的影响

- **磁盘空间**: 每个请求大约占用1-5KB磁盘空间
- **性能开销**: 异步写入，对请求处理性能影响很小
- **内存使用**: 最小，日志写入后立即释放内存

### 优化建议

1. **生产环境**: 考虑禁用请求体记录 (`includeBody: false`)
2. **调试期间**: 可以缩短保留天数 (`retentionDays: 3`)
3. **高负载环境**: 可以完全禁用 (`enabled: false`)

## 故障排除

### 常见问题

**日志目录不存在**
```bash
# 检查日志目录
ls ~/.mongodb/mongodb-mcp/.app-logs/requests/
# 或 Windows
dir %LOCALAPPDATA%\mongodb\mongodb-mcp\.app-logs\requests\
```

**权限问题**
```bash
# 确保有写入权限
chmod 755 ~/.mongodb/mongodb-mcp/.app-logs/
```

**磁盘空间不足**
```bash
# 手动清理旧日志
npm run logs:request:cleanup 1
```

### 调试日志记录

启用详细日志来调试请求记录功能：

```bash
export MDB_MCP_LOG_LEVEL=debug
```

查看服务器日志中的相关消息：
- `收到请求 [ID]: [方法] - 已记录到文件`
- `记录请求失败 [ID]: [错误]`
- `请求日志清理完成`

## 示例场景

### 调试客户端问题

1. 启用请求日志
2. 重现问题
3. 查看最近的请求：`npm run logs:request:recent`
4. 搜索特定工具：`npm run logs:request search "find"`

### 分析使用模式

1. 运行一段时间
2. 查看统计信息：`npm run logs:request:stats`
3. 分析最常用的方法和工具

### 性能监控

1. 检查请求频率和大小
2. 监控日志文件增长
3. 及时清理过期日志

## 配置示例

### 最小日志配置（生产环境）

```bash
export MDB_MCP_REQUEST_LOGGING_ENABLED=true
export MDB_MCP_REQUEST_LOGGING_RETENTION_DAYS=3
export MDB_MCP_REQUEST_LOGGING_INCLUDE_HEADERS=false
export MDB_MCP_REQUEST_LOGGING_INCLUDE_BODY=false
```

### 完整调试配置（开发环境）

```bash
export MDB_MCP_REQUEST_LOGGING_ENABLED=true
export MDB_MCP_REQUEST_LOGGING_RETENTION_DAYS=7
export MDB_MCP_REQUEST_LOGGING_INCLUDE_HEADERS=true
export MDB_MCP_REQUEST_LOGGING_INCLUDE_BODY=true
export MDB_MCP_LOG_LEVEL=debug
``` 