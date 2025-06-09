#!/usr/bin/env node

/**
 * 请求日志查看器
 * 用于查看和分析MCP服务器的请求日志
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// 默认日志路径
const getDefaultLogPath = () => {
    const localDataPath = process.platform === 'win32'
        ? path.join(process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(), 'mongodb')
        : path.join(os.homedir(), '.mongodb');
    
    return path.join(localDataPath, 'mongodb-mcp', '.app-logs', 'requests');
};

async function listRequestLogs(logDir) {
    try {
        const files = await fs.readdir(logDir);
        const requestFiles = files
            .filter(file => file.startsWith('request_') && file.endsWith('.json'))
            .sort()
            .reverse(); // 最新的在前面

        return requestFiles;
    } catch (error) {
        console.error('无法读取日志目录:', error.message);
        return [];
    }
}

async function readRequestLog(logDir, filename) {
    try {
        const filePath = path.join(logDir, filename);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`无法读取日志文件 ${filename}:`, error.message);
        return null;
    }
}

async function showLogStats(logDir) {
    const files = await listRequestLogs(logDir);
    
    if (files.length === 0) {
        console.log('📭 没有找到请求日志文件');
        return;
    }

    let totalSize = 0;
    let totalRequests = 0;
    const methods = {};
    const dates = {};

    console.log('📊 请求日志统计信息:');
    console.log('─'.repeat(50));

    for (const file of files) {
        try {
            const filePath = path.join(logDir, file);
            const stats = await fs.stat(filePath);
            totalSize += stats.size;

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
            console.error(`处理文件 ${file} 时出错:`, error.message);
        }
    }

    console.log(`📁 总文件数: ${files.length}`);
    console.log(`📊 总请求数: ${totalRequests}`);
    console.log(`💾 总大小: ${(totalSize / 1024).toFixed(2)} KB`);
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
}

async function showRecentLogs(logDir, count = 5) {
    const files = await listRequestLogs(logDir);
    
    if (files.length === 0) {
        console.log('📭 没有找到请求日志文件');
        return;
    }

    console.log(`📋 最近 ${Math.min(count, files.length)} 个请求:`);
    console.log('─'.repeat(80));

    for (let i = 0; i < Math.min(count, files.length); i++) {
        const log = await readRequestLog(logDir, files[i]);
        if (log) {
            const time = new Date(log.timestamp).toLocaleString('zh-CN');
            const method = log.method || 'unknown';
            const clientInfo = log.clientInfo ? 
                `${log.clientInfo.name || 'unknown'}@${log.clientInfo.version || 'unknown'}` : 
                'unknown';

            console.log(`🕐 ${time}`);
            console.log(`🆔 请求ID: ${log.requestId}`);
            console.log(`🔧 方法: ${method}`);
            console.log(`🖥️  客户端: ${clientInfo}`);
            
            if (log.config && log.config.includeBody && log.body) {
                console.log(`📦 请求体: ${JSON.stringify(log.body, null, 2).substring(0, 200)}...`);
            }
            
            console.log('─'.repeat(80));
        }
    }
}

async function searchLogs(logDir, searchTerm) {
    const files = await listRequestLogs(logDir);
    const results = [];

    for (const file of files) {
        const log = await readRequestLog(logDir, file);
        if (log) {
            const logString = JSON.stringify(log).toLowerCase();
            if (logString.includes(searchTerm.toLowerCase())) {
                results.push({ file, log });
            }
        }
    }

    if (results.length === 0) {
        console.log(`🔍 没有找到包含 "${searchTerm}" 的日志`);
        return;
    }

    console.log(`🔍 找到 ${results.length} 个匹配的日志:`);
    console.log('─'.repeat(80));

    results.forEach(({ file, log }) => {
        const time = new Date(log.timestamp).toLocaleString('zh-CN');
        console.log(`📄 ${file}`);
        console.log(`🕐 ${time}`);
        console.log(`🔧 ${log.method || 'unknown'}`);
        console.log('─'.repeat(40));
    });
}

async function cleanupLogs(logDir, days = 7) {
    const files = await listRequestLogs(logDir);
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const file of files) {
        try {
            const filePath = path.join(logDir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime.getTime() < cutoffTime) {
                await fs.unlink(filePath);
                deletedCount++;
                console.log(`🗑️ 删除: ${file}`);
            }
        } catch (error) {
            console.error(`删除 ${file} 时出错:`, error.message);
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
            console.log('📖 请求日志查看器使用说明:');
            console.log('');
            console.log('命令:');
            console.log('  stats                显示统计信息 (默认)');
            console.log('  recent [数量]        显示最近的请求 (默认5个)');
            console.log('  search <搜索词>      搜索包含特定内容的请求');
            console.log('  cleanup [天数]       清理指定天数前的日志 (默认7天)');
            console.log('  help                 显示帮助信息');
            console.log('');
            console.log('选项:');
            console.log('  --log-dir <路径>     指定日志目录路径');
            console.log('');
            console.log('示例:');
            console.log('  node view-request-logs.js stats');
            console.log('  node view-request-logs.js recent 10');
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
    readRequestLog,
    showLogStats,
    showRecentLogs,
    searchLogs,
    cleanupLogs
}; 