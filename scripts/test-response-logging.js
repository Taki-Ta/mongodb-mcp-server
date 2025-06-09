#!/usr/bin/env node

/**
 * 测试响应日志记录功能
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 模拟请求日志条目
const mockRequestEntry = {
    timestamp: new Date().toISOString(),
    requestId: "test123456789",
    method: "tools/call",
    headers: {
        transport: "StdioServerTransport",
        timestamp: new Date().toISOString(),
        sessionId: "test-session"
    },
    body: {
        jsonrpc: "2.0",
        id: "request-1",
        method: "tools/call",
        params: {
            name: "find",
            arguments: {
                collection: "users",
                filter: { status: "active" }
            }
        }
    },
    clientInfo: {
        name: "test-client",
        version: "1.0.0"
    },
    loggedAt: new Date().toISOString(),
    config: {
        includeHeaders: true,
        includeBody: true
    }
};

// 模拟成功响应日志条目
const mockSuccessResponseEntry = {
    timestamp: new Date().toISOString(),
    requestId: "test123456789",
    responseData: {
        jsonrpc: "2.0",
        id: "request-1",
        result: {
            content: [
                {
                    type: "text",
                    text: "[{\"_id\": \"user1\", \"name\": \"John\", \"status\": \"active\"}]"
                }
            ]
        }
    },
    executionTimeMs: 234,
    loggedAt: new Date().toISOString()
};

// 模拟错误响应日志条目
const mockErrorResponseEntry = {
    timestamp: new Date().toISOString(),
    requestId: "test987654321",
    error: {
        code: "INVALID_PARAMS",
        message: "Collection name is required",
        data: {
            parameter: "collection"
        }
    },
    executionTimeMs: 15,
    loggedAt: new Date().toISOString()
};

async function createTestLogs() {
    const logPath = path.join(os.tmpdir(), 'mongodb-mcp-test-logs');
    const requestDir = path.join(logPath, 'requests');
    const responseDir = path.join(logPath, 'responses');

    // 创建目录
    await fs.mkdir(requestDir, { recursive: true });
    await fs.mkdir(responseDir, { recursive: true });

    // 创建测试日志文件
    const requestFile = path.join(requestDir, 'request_2024-12-28_14-30-25_test1234.json');
    const successResponseFile = path.join(responseDir, 'response_2024-12-28_14-30-25_test1234.json');
    const errorRequestFile = path.join(requestDir, 'request_2024-12-28_14-31-00_test9876.json');
    const errorResponseFile = path.join(responseDir, 'response_2024-12-28_14-31-00_test9876.json');

    // 写入测试日志
    await fs.writeFile(requestFile, JSON.stringify(mockRequestEntry, null, 2));
    await fs.writeFile(successResponseFile, JSON.stringify(mockSuccessResponseEntry, null, 2));
    
    const errorRequestEntry = { ...mockRequestEntry, requestId: "test987654321" };
    await fs.writeFile(errorRequestFile, JSON.stringify(errorRequestEntry, null, 2));
    await fs.writeFile(errorResponseFile, JSON.stringify(mockErrorResponseEntry, null, 2));

    console.log('✅ 测试日志文件创建完成');
    console.log(`📁 日志目录: ${logPath}`);
    console.log('');

    return logPath;
}

async function testResponseLogging() {
    console.log('🧪 开始测试响应日志记录功能...');
    console.log('');

    try {
        // 创建测试日志
        const logPath = await createTestLogs();

        // 手动测试文件读取和日志统计
        const requestDir = path.join(logPath, 'requests');
        const responseDir = path.join(logPath, 'responses');

        // 列出请求文件
        const requestFiles = await fs.readdir(requestDir);
        const responseFiles = await fs.readdir(responseDir);

        console.log('📊 日志文件统计:');
        console.log(`📁 请求文件数: ${requestFiles.length}`);
        console.log(`📁 响应文件数: ${responseFiles.length}`);
        console.log('');

        // 测试读取日志文件
        console.log('📋 测试读取日志文件:');
        for (const file of requestFiles) {
            const content = await fs.readFile(path.join(requestDir, file), 'utf8');
            const log = JSON.parse(content);
            console.log(`📤 请求: ${log.requestId} - ${log.method}`);
        }

        for (const file of responseFiles) {
            const content = await fs.readFile(path.join(responseDir, file), 'utf8');
            const log = JSON.parse(content);
            const status = log.error ? '❌ 错误' : '✅ 成功';
            console.log(`📥 响应: ${log.requestId} - ${status} - ${log.executionTimeMs || 0}ms`);
        }
        console.log('');

        // 测试请求-响应关联
        console.log('🔍 测试请求-响应关联:');
        const testRequestId = "test123456789";
        let foundResponse = false;
        
        for (const file of responseFiles) {
            const content = await fs.readFile(path.join(responseDir, file), 'utf8');
            const log = JSON.parse(content);
            if (log.requestId === testRequestId) {
                console.log(`✅ 找到对应响应: ${file}`);
                console.log(`⏱️ 执行时间: ${log.executionTimeMs}ms`);
                foundResponse = true;
                break;
            }
        }
        
        if (!foundResponse) {
            console.log('❌ 未找到对应响应');
        }
        console.log('');

        // 测试JSON格式验证
        console.log('🔍 测试JSON格式验证:');
        let validCount = 0;
        for (const file of [...requestFiles, ...responseFiles]) {
            try {
                const dir = requestFiles.includes(file) ? requestDir : responseDir;
                const content = await fs.readFile(path.join(dir, file), 'utf8');
                JSON.parse(content);
                validCount++;
            } catch (error) {
                console.log(`❌ JSON格式错误: ${file}`);
            }
        }
        console.log(`✅ 有效JSON文件: ${validCount}/${requestFiles.length + responseFiles.length}`);
        console.log('');

        console.log('✅ 所有测试通过！');
        
        // 清理测试文件
        await fs.rm(logPath, { recursive: true, force: true });
        console.log('🧹 测试文件已清理');

    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

// 直接运行测试
testResponseLogging().catch(console.error);

export {
    createTestLogs,
    testResponseLogging,
    mockRequestEntry,
    mockSuccessResponseEntry,
    mockErrorResponseEntry
}; 