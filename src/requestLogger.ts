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

export class RequestLogger {
    private logDir: string;
    private config: UserConfig['requestLogging'];

    constructor(logPath: string, config: UserConfig['requestLogging']) {
        this.logDir = path.join(logPath, "requests");
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            await fs.mkdir(this.logDir, { recursive: true });
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

    private async logRequest(entry: RequestLogEntry): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            const filename = this.generateFilename(entry.timestamp, entry.requestId);
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

    private generateFilename(timestamp: string, requestId: string): string {
        const date = new Date(timestamp);
        const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
        const timeStr = date.toISOString().slice(11, 19).replace(/:/g, '-'); // HH-MM-SS
        return `request_${dateStr}_${timeStr}_${requestId.slice(0, 8)}.json`;
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
            const files = await fs.readdir(this.logDir);
            const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

            for (const file of files) {
                if (!file.startsWith('request_') || !file.endsWith('.json')) {
                    continue;
                }

                const filePath = path.join(this.logDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime.getTime() < cutoffTime) {
                    await fs.unlink(filePath);
                }
            }
        } catch (error) {
            console.error("清理旧请求日志失败:", error);
        }
    }

    // 获取日志统计信息
    async getLogStats(): Promise<{ totalFiles: number; totalSize: number; oldestFile?: string; newestFile?: string }> {
        if (!this.config.enabled) {
            return { totalFiles: 0, totalSize: 0 };
        }

        try {
            const files = await fs.readdir(this.logDir);
            const requestFiles = files.filter(file => file.startsWith('request_') && file.endsWith('.json'));
            
            let totalSize = 0;
            let oldestTime = Infinity;
            let newestTime = 0;
            let oldestFile = '';
            let newestFile = '';

            for (const file of requestFiles) {
                const filePath = path.join(this.logDir, file);
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
                totalFiles: requestFiles.length,
                totalSize,
                oldestFile: oldestFile || undefined,
                newestFile: newestFile || undefined,
            };
        } catch (error) {
            console.error("获取日志统计失败:", error);
            return { totalFiles: 0, totalSize: 0 };
        }
    }
} 