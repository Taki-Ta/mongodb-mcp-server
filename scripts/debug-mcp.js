#!/usr/bin/env node

/**
 * MCP调试脚本
 * 用于测试和验证MCP工具的JSON输出格式
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 调试配置
const DEBUG_CONFIG = {
    logLevel: 'debug',
    testTools: ['find', 'count', 'list-collections', 'db-stats'],
    testArgs: {
        'find': { collection: 'test' },
        'count': { collection: 'test' },
        'list-collections': { database: 'ChatBI' },
        'db-stats': { database: 'ChatBI' }
    }
};

// 创建调试日志目录
const debugLogDir = path.join(process.cwd(), 'debug-logs');
if (!fs.existsSync(debugLogDir)) {
    fs.mkdirSync(debugLogDir, { recursive: true });
}

console.log('🔍 MCP工具调试脚本启动');
console.log('📁 调试日志目录:', debugLogDir);
console.log('🛠️ 测试工具:', DEBUG_CONFIG.testTools.join(', '));

// 启动MCP服务器进行调试
function startMCPDebugServer() {
    const mcpProcess = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
            ...process.env,
            MDB_MCP_LOG_LEVEL: DEBUG_CONFIG.logLevel,
            MDB_MCP_CONNECTION_STRING: process.env.MDB_MCP_CONNECTION_STRING || 'mongodb://localhost:27017/ChatBI',
            MDB_DB: 'ChatBI'
        }
    });

    const logFile = path.join(debugLogDir, `mcp-debug-${Date.now()}.log`);
    const logStream = fs.createWriteStream(logFile);

    console.log('📝 日志文件:', logFile);

    mcpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        logStream.write(`[STDOUT] ${output}`);
        
        // 检查JSON格式错误
        if (output.includes('JSONDecodeError') || output.includes('JSON')) {
            console.error('❌ 检测到JSON错误:', output);
        }
        
        // 检查工具执行
        if (output.includes('toolOutputGenerated') || output.includes('toolJsonValidation')) {
            console.log('✅ 工具输出日志:', output.trim());
        }
    });

    mcpProcess.stderr.on('data', (data) => {
        const error = data.toString();
        logStream.write(`[STDERR] ${error}`);
        console.error('🚨 错误:', error);
    });

    mcpProcess.on('close', (code) => {
        logStream.end();
        console.log(`🔚 MCP进程结束，退出码: ${code}`);
    });

    // 发送测试请求
    setTimeout(() => {
        console.log('📤 发送测试请求...');
        testMCPTools(mcpProcess);
    }, 2000);

    return mcpProcess;
}

// 测试MCP工具
function testMCPTools(mcpProcess) {
    for (const toolName of DEBUG_CONFIG.testTools) {
        const args = DEBUG_CONFIG.testArgs[toolName] || {};
        
        const request = {
            jsonrpc: "2.0",
            id: Math.random().toString(36).substr(2, 9),
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args
            }
        };

        console.log(`🔧 测试工具: ${toolName}`, args);
        
        mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    }
}

// JSON验证函数
function validateJsonOutput(jsonString) {
    try {
        const parsed = JSON.parse(jsonString);
        console.log('✅ JSON格式有效');
        return { valid: true, data: parsed };
    } catch (error) {
        console.error('❌ JSON格式错误:', error.message);
        console.error('📄 原始内容:', jsonString.substring(0, 200) + '...');
        return { valid: false, error: error.message };
    }
}

// 创建测试报告
function generateDebugReport() {
    const reportFile = path.join(debugLogDir, `debug-report-${Date.now()}.md`);
    const report = `
# MCP工具调试报告

## 测试配置
- 测试时间: ${new Date().toISOString()}
- 测试工具: ${DEBUG_CONFIG.testTools.join(', ')}
- 日志级别: ${DEBUG_CONFIG.logLevel}

## 环境信息
- Node.js版本: ${process.version}
- 平台: ${process.platform}
- 架构: ${process.arch}

## 常见问题排查

### JSON解析错误
如果遇到 "JSONDecodeError: Expecting ',' delimiter" 错误：

1. 检查工具输出是否包含无效的JSON字符
2. 确认MongoDB数据类型被正确序列化（使用EJSON）
3. 查看调试日志中的 \`toolJsonValidation\` 消息

### 连接问题
如果遇到连接错误：

1. 检查 \`MDB_MCP_CONNECTION_STRING\` 环境变量
2. 确认MongoDB服务是否运行
3. 验证数据库访问权限

### 工具执行问题
如果工具执行失败：

1. 查看 \`toolExecuteFailure\` 日志消息
2. 检查工具参数是否正确
3. 验证数据库和集合是否存在

## 调试命令

\`\`\`bash
# 启用详细日志
export MDB_MCP_LOG_LEVEL=debug

# 测试特定工具
node scripts/debug-mcp.js

# 查看实时日志
tail -f debug-logs/mcp-debug-*.log
\`\`\`
`;

    fs.writeFileSync(reportFile, report);
    console.log('📊 调试报告生成:', reportFile);
}

// 主程序
function main() {
    // 检查dist目录是否存在
    if (!fs.existsSync('dist/index.js')) {
        console.error('❌ 请先构建项目: npm run build');
        process.exit(1);
    }

    // 生成调试报告
    generateDebugReport();

    // 启动调试服务器
    const mcpProcess = startMCPDebugServer();

    // 处理程序退出
    process.on('SIGINT', () => {
        console.log('\n⏹️ 停止调试...');
        mcpProcess.kill('SIGTERM');
        process.exit(0);
    });
}

if (require.main === module) {
    main();
}

module.exports = {
    validateJsonOutput,
    generateDebugReport
}; 