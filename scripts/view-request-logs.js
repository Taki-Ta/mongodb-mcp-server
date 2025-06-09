#!/usr/bin/env node

/**
 * 请求日志查看器
 * 用于查看和分析MCP服务器的请求日志和响应日志
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// 默认日志路径
const getDefaultLogPath = () => {
    const localDataPath = process.platform === 'win32'
        ? path.join(process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(), 'mongodb')
        : path.join(os.homedir(), '.mongodb');
    
    return path.join(localDataPath, 'mongodb-mcp', '.app-logs');
};

async function listRequestLogs(logDir) {
    try {
        const requestDir = path.join(logDir, 'requests');
        const files = await fs.readdir(requestDir);
        const requestFiles = files
            .filter(file => file.startsWith('request_') && file.endsWith('.json'))
            .sort()
            .reverse(); // 最新的在前面

        return requestFiles;
    } catch (error) {
        console.error('无法读取请求日志目录:', error.message);
        return [];
    }
}

// 新增：列出响应日志
async function listResponseLogs(logDir) {
    try {
        const responseDir = path.join(logDir, 'responses');
        const files = await fs.readdir(responseDir);
        const responseFiles = files
            .filter(file => file.startsWith('response_') && file.endsWith('.json'))
            .sort()
            .reverse(); // 最新的在前面

        return responseFiles;
    } catch (error) {
        console.error('无法读取响应日志目录:', error.message);
        return [];
    }
}

async function readRequestLog(logDir, filename) {
    try {
        const filePath = path.join(logDir, 'requests', filename);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`无法读取请求日志文件 ${filename}:`, error.message);
        return null;
    }
}

// 新增：读取响应日志
async function readResponseLog(logDir, filename) {
    try {
        const filePath = path.join(logDir, 'responses', filename);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`无法读取响应日志文件 ${filename}:`, error.message);
        return null;
    }
}

// 新增：根据请求ID查找对应的响应日志
async function findResponseByRequestId(logDir, requestId) {
    const responseFiles = await listResponseLogs(logDir);
    
    for (const file of responseFiles) {
        const response = await readResponseLog(logDir, file);
        if (response && response.requestId === requestId) {
            return { file, response };
        }
    }
    
    return null;
}

async function showLogStats(logDir) {
    const requestFiles = await listRequestLogs(logDir);
    const responseFiles = await listResponseLogs(logDir);
    
    if (requestFiles.length === 0 && responseFiles.length === 0) {
        console.log('📭 没有找到日志文件');
        return;
    }

    let requestTotalSize = 0;
    let responseTotalSize = 0;
    let totalRequests = 0;
    let totalResponses = 0;
    const methods = {};
    const dates = {};
    const executionTimes = [];

    console.log('📊 请求响应日志统计信息:');
    console.log('─'.repeat(60));

    // 统计请求日志
    for (const file of requestFiles) {
        try {
            const filePath = path.join(logDir, 'requests', file);
            const stats = await fs.stat(filePath);
            requestTotalSize += stats.size;

            const log = await readRequestLog(logDir, file);
            if (log) {
                totalRequests++;
                
                // 统计方法
                const method = log.method || 'unknown';
                methods[method] = (methods[method] || 0) + 1;

                // 统计日期
                const date = log.timestamp.split('T')[0];
                dates[date] = (dates[date] || 0) + 1;
            }
        } catch (error) {
            console.error(`处理请求文件 ${file} 时出错:`, error.message);
        }
    }

    // 统计响应日志
    for (const file of responseFiles) {
        try {
            const filePath = path.join(logDir, 'responses', file);
            const stats = await fs.stat(filePath);
            responseTotalSize += stats.size;

            const log = await readResponseLog(logDir, file);
            if (log) {
                totalResponses++;
                
                // 收集执行时间
                if (log.executionTimeMs !== undefined) {
                    executionTimes.push(log.executionTimeMs);
                }
            }
        } catch (error) {
            console.error(`处理响应文件 ${file} 时出错:`, error.message);
        }
    }

    console.log(`📁 请求文件数: ${requestFiles.length} (${(requestTotalSize / 1024).toFixed(2)} KB)`);
    console.log(`📁 响应文件数: ${responseFiles.length} (${(responseTotalSize / 1024).toFixed(2)} KB)`);
    console.log(`📊 总请求数: ${totalRequests}`);
    console.log(`📊 总响应数: ${totalResponses}`);
    console.log(`💾 总大小: ${((requestTotalSize + responseTotalSize) / 1024).toFixed(2)} KB`);
    console.log('');

    console.log('🔧 请求方法统计:');
    Object.entries(methods)
        .sort(([,a], [,b]) => b - a)
        .forEach(([method, count]) => {
            console.log(`  ${method}: ${count}`);
        });
    console.log('');

    console.log('📅 按日期统计:');
    Object.entries(dates)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 7) // 显示最近7天
        .forEach(([date, count]) => {
            console.log(`  ${date}: ${count}`);
        });
    console.log('');

    // 执行时间统计
    if (executionTimes.length > 0) {
        const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
        const maxTime = Math.max(...executionTimes);
        const minTime = Math.min(...executionTimes);
        
        console.log('⏱️ 执行时间统计:');
        console.log(`  平均执行时间: ${avgTime.toFixed(2)}ms`);
        console.log(`  最大执行时间: ${maxTime}ms`);
        console.log(`  最小执行时间: ${minTime}ms`);
    }
}

async function showRecentLogs(logDir, count = 5) {
    const requestFiles = await listRequestLogs(logDir);
    
    if (requestFiles.length === 0) {
        console.log('📭 没有找到请求日志文件');
        return;
    }

    console.log(`📋 最近 ${Math.min(count, requestFiles.length)} 个请求响应对:`);
    console.log('─'.repeat(80));

    for (let i = 0; i < Math.min(count, requestFiles.length); i++) {
        const requestLog = await readRequestLog(logDir, requestFiles[i]);
        if (requestLog) {
            const time = new Date(requestLog.timestamp).toLocaleString('zh-CN');
            const method = requestLog.method || 'unknown';
            const clientInfo = requestLog.clientInfo ? 
                `${requestLog.clientInfo.name || 'unknown'}@${requestLog.clientInfo.version || 'unknown'}` : 
                'unknown';

            console.log(`🕐 ${time}`);
            console.log(`🆔 请求ID: ${requestLog.requestId}`);
            console.log(`🔧 方法: ${method}`);
            console.log(`🖥️ 客户端: ${clientInfo}`);
            
            // 查找对应的响应
            const responseData = await findResponseByRequestId(logDir, requestLog.requestId);
            if (responseData) {
                const { response } = responseData;
                console.log(`✅ 响应状态: ${response.error ? '❌ 错误' : '✅ 成功'}`);
                if (response.executionTimeMs !== undefined) {
                    console.log(`⏱️ 执行时间: ${response.executionTimeMs}ms`);
                }
                if (response.error) {
                    console.log(`❌ 错误信息: ${response.error.message || '未知错误'}`);
                }
            } else {
                console.log(`❓ 响应状态: 未找到对应响应`);
            }
            
            if (requestLog.config && requestLog.config.includeBody && requestLog.body) {
                console.log(`📦 请求体: ${JSON.stringify(requestLog.body, null, 2).substring(0, 200)}...`);
            }
            
            console.log('─'.repeat(80));
        }
    }
}

// 新增：显示完整的请求-响应对
async function showRequestResponsePair(logDir, requestId) {
    const requestFiles = await listRequestLogs(logDir);
    let requestLog = null;
    
    // 查找请求
    for (const file of requestFiles) {
        const log = await readRequestLog(logDir, file);
        if (log && log.requestId === requestId) {
            requestLog = log;
            break;
        }
    }
    
    if (!requestLog) {
        console.log(`❌ 未找到请求ID: ${requestId}`);
        return;
    }
    
    const responseData = await findResponseByRequestId(logDir, requestId);
    
    console.log('📋 请求-响应详情:');
    console.log('─'.repeat(80));
    console.log('📤 请求信息:');
    console.log(JSON.stringify(requestLog, null, 2));
    console.log('─'.repeat(40));
    
    if (responseData) {
        console.log('📥 响应信息:');
        console.log(JSON.stringify(responseData.response, null, 2));
    } else {
        console.log('❓ 未找到对应的响应日志');
    }
}

async function searchLogs(logDir, searchTerm) {
    const requestFiles = await listRequestLogs(logDir);
    const responseFiles = await listResponseLogs(logDir);
    const results = [];

    // 搜索请求日志
    for (const file of requestFiles) {
        const log = await readRequestLog(logDir, file);
        if (log) {
            const logString = JSON.stringify(log).toLowerCase();
            if (logString.includes(searchTerm.toLowerCase())) {
                results.push({ type: 'request', file, log });
            }
        }
    }

    // 搜索响应日志
    for (const file of responseFiles) {
        const log = await readResponseLog(logDir, file);
        if (log) {
            const logString = JSON.stringify(log).toLowerCase();
            if (logString.includes(searchTerm.toLowerCase())) {
                results.push({ type: 'response', file, log });
            }
        }
    }

    if (results.length === 0) {
        console.log(`🔍 没有找到包含 "${searchTerm}" 的日志`);
        return;
    }

    console.log(`🔍 找到 ${results.length} 个匹配的日志:`);
    console.log('─'.repeat(80));

    results.forEach(({ type, file, log }) => {
        const time = new Date(log.timestamp).toLocaleString('zh-CN');
        const icon = type === 'request' ? '📤' : '📥';
        console.log(`${icon} ${type} - ${file}`);
        console.log(`🕐 ${time}`);
        console.log(`🆔 请求ID: ${log.requestId}`);
        if (type === 'request') {
            console.log(`🔧 ${log.method || 'unknown'}`);
        } else if (log.executionTimeMs !== undefined) {
            console.log(`⏱️ 执行时间: ${log.executionTimeMs}ms`);
        }
        console.log('─'.repeat(40));
    });
}

async function cleanupLogs(logDir, days = 7) {
    const requestFiles = await listRequestLogs(logDir);
    const responseFiles = await listResponseLogs(logDir);
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    // 清理请求日志
    for (const file of requestFiles) {
        try {
            const filePath = path.join(logDir, 'requests', file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime.getTime() < cutoffTime) {
                await fs.unlink(filePath);
                deletedCount++;
                console.log(`🗑️ 删除请求: ${file}`);
            }
        } catch (error) {
            console.error(`删除请求 ${file} 时出错:`, error.message);
        }
    }

    // 清理响应日志
    for (const file of responseFiles) {
        try {
            const filePath = path.join(logDir, 'responses', file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime.getTime() < cutoffTime) {
                await fs.unlink(filePath);
                deletedCount++;
                console.log(`🗑️ 删除响应: ${file}`);
            }
        } catch (error) {
            console.error(`删除响应 ${file} 时出错:`, error.message);
        }
    }

    console.log(`✅ 清理完成，删除了 ${deletedCount} 个文件`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'stats';
    const logDir = args.includes('--log-dir') ? 
        args[args.indexOf('--log-dir') + 1] : 
        getDefaultLogPath();

    console.log(`📁 日志目录: ${logDir}`);
    console.log('');

    try {
        await fs.access(logDir);
    } catch (error) {
        console.log('❌ 日志目录不存在或无法访问');
        console.log('💡 请确认MCP服务器已启用请求日志记录');
        return;
    }

    switch (command) {
        case 'stats':
            await showLogStats(logDir);
            break;

        case 'recent':
            const count = parseInt(args[1]) || 5;
            await showRecentLogs(logDir, count);
            break;

        case 'pair':
            const requestId = args[1];
            if (!requestId) {
                console.log('❌ 请提供请求ID');
                console.log('用法: node view-request-logs.js pair <请求ID>');
                return;
            }
            await showRequestResponsePair(logDir, requestId);
            break;

        case 'search':
            const searchTerm = args[1];
            if (!searchTerm) {
                console.log('❌ 请提供搜索词');
                console.log('用法: node view-request-logs.js search <搜索词>');
                return;
            }
            await searchLogs(logDir, searchTerm);
            break;

        case 'cleanup':
            const days = parseInt(args[1]) || 7;
            console.log(`🧹 清理 ${days} 天前的日志...`);
            await cleanupLogs(logDir, days);
            break;

        case 'help':
        default:
            console.log('📖 请求响应日志查看器使用说明:');
            console.log('');
            console.log('命令:');
            console.log('  stats                显示统计信息 (默认)');
            console.log('  recent [数量]        显示最近的请求响应对 (默认5个)');
            console.log('  pair <请求ID>        显示完整的请求-响应对');
            console.log('  search <搜索词>      搜索包含特定内容的请求或响应');
            console.log('  cleanup [天数]       清理指定天数前的日志 (默认7天)');
            console.log('  help                 显示帮助信息');
            console.log('');
            console.log('选项:');
            console.log('  --log-dir <路径>     指定日志目录路径');
            console.log('');
            console.log('示例:');
            console.log('  node view-request-logs.js stats');
            console.log('  node view-request-logs.js recent 10');
            console.log('  node view-request-logs.js pair abc12345');
            console.log('  node view-request-logs.js search "find"');
            console.log('  node view-request-logs.js cleanup 3');
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    listRequestLogs,
    listResponseLogs,
    readRequestLog,
    readResponseLog,
    findResponseByRequestId,
    showLogStats,
    showRecentLogs,
    showRequestResponsePair,
    searchLogs,
    cleanupLogs
}; 