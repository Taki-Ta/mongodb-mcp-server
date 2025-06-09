import fs from "fs/promises";
import path from "path";
import { UserConfig } from "./config.js";

export interface RequestLogEntry {
    timestamp: string;
    requestId: string;
    method?: string;
    headers?: Record<string, unknown>;
    body?: unknown;
    clientInfo?: {
        name?: string;
        version?: string;
    };
}

// 新增响应日志条目接口
export interface ResponseLogEntry {
    timestamp: string;
    requestId: string;
    responseData?: unknown;
    error?: {
        code?: string;
        message?: string;
        data?: unknown;
    };
    executionTimeMs?: number;
}

export class RequestLogger {
    private logDir: string;
    private responseLogDir: string;
    private config: UserConfig['requestLogging'];

    constructor(logPath: string, config: UserConfig['requestLogging']) {
        this.logDir = path.join(logPath, "requests");
        this.responseLogDir = path.join(logPath, "responses");
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            await fs.mkdir(this.logDir, { recursive: true });
            await fs.mkdir(this.responseLogDir, { recursive: true });
        } catch (error) {
            console.error("无法创建请求日志目录:", error);
            // 关闭日志记录以避免继续报错
            this.config = { ...this.config, enabled: false };
        }
    }

    async logFullRequest(requestId: string, method: string, headers: Record<string, unknown>, body: unknown, clientInfo?: { name?: string; version?: string }): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        const entry: RequestLogEntry = {
            timestamp: new Date().toISOString(),
            requestId,
            method,
            ...(this.config.includeHeaders && { headers: this.sanitizeHeaders(headers) }),
            ...(this.config.includeBody && { body: this.sanitizeBody(body) }),
            clientInfo,
        };

        await this.logRequest(entry);
    }

    // 新增：记录响应的方法
    async logResponse(requestId: string, responseData?: unknown, error?: { code?: string; message?: string; data?: unknown }, startTime?: number): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        const executionTimeMs = startTime ? Date.now() - startTime : undefined;

        const entry: ResponseLogEntry = {
            timestamp: new Date().toISOString(),
            requestId,
        };

        if (responseData) {
            entry.responseData = this.sanitizeBody(responseData);
        }
        
        if (error) {
            entry.error = error;
        }
        
        if (executionTimeMs !== undefined) {
            entry.executionTimeMs = executionTimeMs;
        }

        await this.logResponseEntry(entry);
    }

    private async logRequest(entry: RequestLogEntry): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            const filename = this.generateRequestFilename(entry.timestamp, entry.requestId);
            const logContent = {
                ...entry,
                loggedAt: new Date().toISOString(),
                config: {
                    includeHeaders: this.config.includeHeaders,
                    includeBody: this.config.includeBody,
                }
            };

            const logData = JSON.stringify(logContent, null, 2);
            await fs.writeFile(path.join(this.logDir, filename), logData, 'utf8');
        } catch (error) {
            console.error("写入请求日志失败:", error);
        }
    }

    // 新增：写入响应日志的私有方法
    private async logResponseEntry(entry: ResponseLogEntry): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            const filename = this.generateResponseFilename(entry.timestamp, entry.requestId);
            const logContent = {
                ...entry,
                loggedAt: new Date().toISOString(),
            };

            const logData = JSON.stringify(logContent, null, 2);
            await fs.writeFile(path.join(this.responseLogDir, filename), logData, 'utf8');
        } catch (error) {
            console.error("写入响应日志失败:", error);
        }
    }

    private generateRequestFilename(timestamp: string, requestId: string): string {
        const date = new Date(timestamp);
        const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
        const timeStr = date.toISOString().slice(11, 19).replace(/:/g, '-'); // HH-MM-SS
        return `request_${dateStr}_${timeStr}_${requestId.slice(0, 8)}.json`;
    }

    // 新增：生成响应文件名的方法
    private generateResponseFilename(timestamp: string, requestId: string): string {
        const date = new Date(timestamp);
        const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
        const timeStr = date.toISOString().slice(11, 19).replace(/:/g, '-'); // HH-MM-SS
        return `response_${dateStr}_${timeStr}_${requestId.slice(0, 8)}.json`;
    }

    private sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
        const sanitized = { ...headers };
        
        // 移除敏感信息
        const sensitiveKeys = ['authorization', 'cookie', 'x-api-key', 'bearer', 'token'];
        for (const key of Object.keys(sanitized)) {
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                sanitized[key] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }

    private sanitizeBody(body: unknown): unknown {
        if (typeof body === 'object' && body !== null) {
            const sanitized = JSON.parse(JSON.stringify(body));
            
            // 递归移除敏感字段
            this.recursiveSanitize(sanitized);
            return sanitized;
        }
        
        return body;
    }

    private recursiveSanitize(obj: any): void {
        if (typeof obj !== 'object' || obj === null) {
            return;
        }

        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'connectionstring'];
        
        for (const [key, value] of Object.entries(obj)) {
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                obj[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                this.recursiveSanitize(value);
            }
        }
    }

    async cleanupOldLogs(): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            // 清理请求日志
            await this.cleanupDirectory(this.logDir, 'request_');
            // 清理响应日志
            await this.cleanupDirectory(this.responseLogDir, 'response_');
        } catch (error) {
            console.error("清理旧请求日志失败:", error);
        }
    }

    // 新增：清理指定目录的方法
    private async cleanupDirectory(directory: string, prefix: string): Promise<void> {
        try {
            const files = await fs.readdir(directory);
            const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

            for (const file of files) {
                if (!file.startsWith(prefix) || !file.endsWith('.json')) {
                    continue;
                }

                const filePath = path.join(directory, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime.getTime() < cutoffTime) {
                    await fs.unlink(filePath);
                }
            }
        } catch (error: any) {
            // 目录可能不存在，静默处理
            if (error?.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    // 获取日志统计信息（更新以包含响应日志）
    async getLogStats(): Promise<{ 
        requests: { totalFiles: number; totalSize: number; oldestFile?: string; newestFile?: string };
        responses: { totalFiles: number; totalSize: number; oldestFile?: string; newestFile?: string };
    }> {
        if (!this.config.enabled) {
            return { 
                requests: { totalFiles: 0, totalSize: 0 },
                responses: { totalFiles: 0, totalSize: 0 }
            };
        }

        try {
            const requestStats = await this.getDirectoryStats(this.logDir, 'request_');
            const responseStats = await this.getDirectoryStats(this.responseLogDir, 'response_');

            return {
                requests: requestStats,
                responses: responseStats,
            };
        } catch (error) {
            console.error("获取日志统计失败:", error);
            return { 
                requests: { totalFiles: 0, totalSize: 0 },
                responses: { totalFiles: 0, totalSize: 0 }
            };
        }
    }

    // 新增：获取指定目录统计信息的方法
    private async getDirectoryStats(directory: string, prefix: string): Promise<{ totalFiles: number; totalSize: number; oldestFile?: string; newestFile?: string }> {
        try {
            const files: string[] = await fs.readdir(directory);
            const targetFiles = files.filter((file: string) => file.startsWith(prefix) && file.endsWith('.json'));
            
            let totalSize = 0;
            let oldestTime = Infinity;
            let newestTime = 0;
            let oldestFile = '';
            let newestFile = '';

            for (const file of targetFiles) {
                const filePath = path.join(directory, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;

                if (stats.mtime.getTime() < oldestTime) {
                    oldestTime = stats.mtime.getTime();
                    oldestFile = file;
                }

                if (stats.mtime.getTime() > newestTime) {
                    newestTime = stats.mtime.getTime();
                    newestFile = file;
                }
            }

            return {
                totalFiles: targetFiles.length,
                totalSize,
                oldestFile: oldestFile || undefined,
                newestFile: newestFile || undefined,
            };
        } catch (error: any) {
            if (error?.code === 'ENOENT') {
                return { totalFiles: 0, totalSize: 0 };
            }
            throw error;
        }
    }
} 