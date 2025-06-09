# MongoDB MCP 服务器调试指南

## JSON解析错误排查

当您遇到 `JSONDecodeError: Expecting ',' delimiter` 错误时，请按以下步骤进行调试：

### 1. 启用详细日志

```bash
# 设置环境变量启用调试日志
export MDB_MCP_LOG_LEVEL=debug

# 或在启动MCP时设置
MDB_MCP_LOG_LEVEL=debug npx mongodb-mcp-server
```

### 2. 使用调试脚本

我们提供了专门的调试脚本来测试和验证工具输出：

```bash
# 运行调试脚本
npm run debug

# 仅测试JSON格式
npm run debug:json

# 清理调试日志
npm run logs:clean
```

### 3. 手动测试工具

您也可以手动测试特定工具：

```bash
# 构建项目
npm run build

# 启动MCP服务器（在一个终端）
node dist/index.js

# 在另一个终端发送测试请求
echo '{"jsonrpc":"2.0","id":"test","method":"tools/call","params":{"name":"find","arguments":{"collection":"test"}}}' | node dist/index.js
```

### 4. 查看日志文件

调试脚本会在 `debug-logs/` 目录中生成详细的日志文件：

```bash
# 查看最新的调试日志
ls -la debug-logs/

# 实时查看日志
tail -f debug-logs/mcp-debug-*.log
```

## 常见JSON错误及解决方案

### 1. MongoDB数据类型问题

**错误**: ObjectId、Date等MongoDB特有类型导致的JSON解析错误

**解决**: 我们已将所有MongoDB相关工具改为使用 `EJSON.stringify()` 而不是 `JSON.stringify()`

```javascript
// ❌ 错误方式
return { content: [{ text: JSON.stringify(documents), type: "text" }] };

// ✅ 正确方式  
return { content: [{ text: EJSON.stringify(documents, null, 2), type: "text" }] };
```

### 2. 特殊字符问题

**错误**: 控制字符或特殊字符导致JSON无效

**解决**: 工具基类现在会自动清理和验证JSON输出

### 3. 空数据处理

**错误**: 空结果或undefined值导致的JSON问题

**解决**: 确保所有工具都返回有效的JSON，即使是空结果

## 工具输出格式标准

所有工具现在都遵循以下输出格式：

```javascript
{
  "content": [
    {
      "text": "有效的JSON字符串",
      "type": "text"
    }
  ]
}
```

### 数据工具示例

```javascript
// find工具输出
{
  "content": [
    {
      "text": "[{\"_id\":{\"$oid\":\"...\"}, \"name\":\"test\"}]",
      "type": "text"
    }
  ]
}

// count工具输出
{
  "content": [
    {
      "text": "{\"count\": 42}",
      "type": "text"
    }
  ]
}
```

### 错误输出示例

```javascript
// 集合未找到错误
{
  "content": [
    {
      "text": "{\"error\": \"Collection not found\"}",
      "type": "text"
    }
  ],
  "isError": true
}
```

## 调试配置选项

### 环境变量

- `MDB_MCP_LOG_LEVEL`: 日志级别 (debug, info, warning, error)
- `MDB_MCP_CONNECTION_STRING`: MongoDB连接字符串
- `MDB_DB`: 默认数据库名称

### 调试脚本配置

在 `scripts/debug-mcp.js` 中可以修改：

```javascript
const DEBUG_CONFIG = {
    logLevel: 'debug',
    testTools: ['find', 'count', 'list-collections', 'db-stats'],
    testArgs: {
        'find': { collection: 'test' },
        'count': { collection: 'test' },
        // ...
    }
};
```

## 报告问题

如果您仍然遇到JSON问题，请提供以下信息：

1. 错误的完整信息
2. 使用的工具名称和参数
3. 调试日志文件 (`debug-logs/mcp-debug-*.log`)
4. MongoDB版本和数据示例

### 收集调试信息

```bash
# 生成完整的调试报告
npm run debug > debug-output.txt 2>&1

# 包含以下信息
echo "Node.js版本: $(node --version)" >> debug-info.txt
echo "MongoDB MCP版本: $(npm list mongodb-mcp-server)" >> debug-info.txt
echo "操作系统: $(uname -a)" >> debug-info.txt
```

## 自动修复功能

工具基类现在包含自动JSON格式修复功能：

1. **格式清理**: 移除控制字符和多余空白
2. **结构修复**: 为非对象/数组数据添加包装
3. **降级处理**: 无法修复时返回错误信息的JSON格式

这些功能会在日志中记录，帮助您了解数据是如何被处理的。 