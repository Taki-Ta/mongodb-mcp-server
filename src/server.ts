import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Session } from "./session.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { AtlasTools } from "./tools/atlas/tools.js";
import { MongoDbTools } from "./tools/mongodb/tools.js";
import logger, { initializeLogger, LogId } from "./logger.js";
import { ObjectId } from "mongodb";
import { Telemetry } from "./telemetry/telemetry.js";
import { UserConfig } from "./config.js";
import { type ServerEvent } from "./telemetry/types.js";
import { type ServerCommand } from "./telemetry/types.js";
import { CallToolRequestSchema, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import assert from "assert";
import { RequestLogger } from "./requestLogger.js";

export interface ServerOptions {
    session: Session;
    userConfig: UserConfig;
    mcpServer: McpServer;
    telemetry: Telemetry;
}

export class Server {
    public readonly session: Session;
    private readonly mcpServer: McpServer;
    private readonly telemetry: Telemetry;
    public readonly userConfig: UserConfig;
    private readonly startTime: number;
    private readonly requestLogger: RequestLogger;

    constructor({ session, mcpServer, userConfig, telemetry }: ServerOptions) {
        this.startTime = Date.now();
        this.session = session;
        this.telemetry = telemetry;
        this.mcpServer = mcpServer;
        this.userConfig = userConfig;
        this.requestLogger = new RequestLogger(userConfig.logPath, userConfig.requestLogging);
    }

    async connect(transport: Transport): Promise<void> {
        // 初始化请求日志记录器
        await this.requestLogger.initialize();

        this.mcpServer.server.registerCapabilities({ logging: {} });

        this.registerTools();
        this.registerResources();

        // This is a workaround for an issue we've seen with some models, where they'll see that everything in the `arguments`
        // object is optional, and then not pass it at all. However, the MCP server expects the `arguments` object to be if
        // the tool accepts any arguments, even if they're all optional.
        //
        // see: https://github.com/modelcontextprotocol/typescript-sdk/blob/131776764536b5fdca642df51230a3746fb4ade0/src/server/mcp.ts#L705
        // Since paramsSchema here is not undefined, the server will create a non-optional z.object from it.
        const existingHandler = (
            this.mcpServer.server["_requestHandlers"] as Map<
                string,
                (request: unknown, extra: unknown) => Promise<CallToolResult>
            >
        ).get(CallToolRequestSchema.shape.method.value);

        assert(existingHandler, "No existing handler found for CallToolRequestSchema");

        this.mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request, extra): Promise<CallToolResult> => {
            // 生成请求ID
            const requestId = new ObjectId().toString();
            const startTime = Date.now(); // 记录开始时间
            
            // 记录请求信息
            try {
                const clientInfo = {
                    name: this.mcpServer.server.getClientVersion()?.name,
                    version: this.mcpServer.server.getClientVersion()?.version,
                };

                // 记录完整请求（包括请求头和请求体）
                await this.requestLogger.logFullRequest(
                    requestId,
                    request.method || 'unknown',
                    {
                        // 从transport中提取可能的请求头信息
                        transport: transport.constructor.name,
                        timestamp: new Date().toISOString(),
                        sessionId: this.session.sessionId,
                    },
                    request,
                    clientInfo
                );

                logger.debug(
                    LogId.toolInputReceived, 
                    "server", 
                    `收到请求 ${requestId}: ${request.method} - 已记录到文件`
                );
            } catch (error) {
                logger.error(
                    LogId.toolExecuteFailure, 
                    "server", 
                    `记录请求失败 ${requestId}: ${error}`
                );
            }

            if (!request.params.arguments) {
                request.params.arguments = {};
            }

            // 执行原始处理器并记录响应
            try {
                const response = await existingHandler(request, extra);
                
                // 记录成功响应
                try {
                    await this.requestLogger.logResponse(requestId, response, undefined, startTime);
                    
                    logger.debug(
                        LogId.toolOutputGenerated, 
                        "server", 
                        `响应已记录 ${requestId}: 执行时间 ${Date.now() - startTime}ms`
                    );
                } catch (logError) {
                    logger.error(
                        LogId.toolExecuteFailure, 
                        "server", 
                        `记录响应失败 ${requestId}: ${logError}`
                    );
                }
                
                return response;
            } catch (handlerError) {
                // 记录错误响应
                try {
                    const errorInfo = {
                        code: handlerError.code || 'UNKNOWN_ERROR',
                        message: handlerError.message || '未知错误',
                        data: handlerError.data || undefined,
                    };
                    
                    await this.requestLogger.logResponse(requestId, undefined, errorInfo, startTime);
                    
                    logger.debug(
                        LogId.toolExecuteFailure, 
                        "server", 
                        `错误响应已记录 ${requestId}: ${errorInfo.message}`
                    );
                } catch (logError) {
                    logger.error(
                        LogId.toolExecuteFailure, 
                        "server", 
                        `记录错误响应失败 ${requestId}: ${logError}`
                    );
                }
                
                // 重新抛出原始错误
                throw handlerError;
            }
        });

        await initializeLogger(this.mcpServer, this.userConfig.logPath);

        await this.mcpServer.connect(transport);

        this.mcpServer.server.oninitialized = () => {
            this.session.setAgentRunner(this.mcpServer.server.getClientVersion());
            this.session.sessionId = new ObjectId().toString();

            logger.info(
                LogId.serverInitialized,
                "server",
                `Server started with transport ${transport.constructor.name} and agent runner ${this.session.agentRunner?.name}`
            );

            this.emitServerEvent("start", Date.now() - this.startTime);

            // 启动日志清理任务
            this.startLogCleanupTask();
        };

        this.mcpServer.server.onclose = () => {
            const closeTime = Date.now();
            this.emitServerEvent("stop", Date.now() - closeTime);
        };

        this.mcpServer.server.onerror = (error: Error) => {
            const closeTime = Date.now();
            this.emitServerEvent("stop", Date.now() - closeTime, error);
        };

        await this.validateConfig();
    }

    async close(): Promise<void> {
        await this.telemetry.close();
        await this.session.close();
        await this.mcpServer.close();
    }

    /**
     * 启动日志清理任务
     */
    private startLogCleanupTask(): void {
        // 每天清理一次过期的请求日志
        const cleanupInterval = 24 * 60 * 60 * 1000; // 24小时
        
        setInterval(async () => {
            try {
                await this.requestLogger.cleanupOldLogs(); // 使用配置中的保留天数
                logger.debug(LogId.serverInitialized, "server", "请求日志清理完成");
            } catch (error) {
                logger.error(LogId.serverStartFailure, "server", `请求日志清理失败: ${error}`);
            }
        }, cleanupInterval);

        // 立即执行一次清理
        this.requestLogger.cleanupOldLogs().catch((error) => {
            logger.error(LogId.serverStartFailure, "server", `初始请求日志清理失败: ${error}`);
        });
    }

    /**
     * Emits a server event
     * @param command - The server command (e.g., "start", "stop", "register", "deregister")
     * @param additionalProperties - Additional properties specific to the event
     */
    emitServerEvent(command: ServerCommand, commandDuration: number, error?: Error) {
        const event: ServerEvent = {
            timestamp: new Date().toISOString(),
            source: "mdbmcp",
            properties: {
                result: "success",
                duration_ms: commandDuration,
                component: "server",
                category: "other",
                command: command,
            },
        };

        if (command === "start") {
            event.properties.startup_time_ms = commandDuration;
            event.properties.read_only_mode = this.userConfig.readOnly || false;
            event.properties.disabled_tools = this.userConfig.disabledTools || [];
        }
        if (command === "stop") {
            event.properties.runtime_duration_ms = Date.now() - this.startTime;
            if (error) {
                event.properties.result = "failure";
                event.properties.reason = error.message;
            }
        }

        this.telemetry.emitEvents([event]).catch(() => {});
    }

    private registerTools() {
        for (const tool of [...AtlasTools, ...MongoDbTools]) {
            new tool(this.session, this.userConfig, this.telemetry).register(this.mcpServer);
        }
    }

    private registerResources() {
        this.mcpServer.resource(
            "config",
            "config://config",
            {
                description:
                    "Server configuration, supplied by the user either as environment variables or as startup arguments",
            },
            (uri) => {
                const result = {
                    telemetry: this.userConfig.telemetry,
                    logPath: this.userConfig.logPath,
                    connectionString: this.userConfig.connectionString
                        ? "set; access to MongoDB tools are currently available to use"
                        : "not set; before using any MongoDB tool, you need to configure a connection string, alternatively you can setup MongoDB Atlas access, more info at 'https://github.com/mongodb-js/mongodb-mcp-server'.",
                    connectOptions: this.userConfig.connectOptions,
                    atlas:
                        this.userConfig.apiClientId && this.userConfig.apiClientSecret
                            ? "set; MongoDB Atlas tools are currently available to use"
                            : "not set; MongoDB Atlas tools are currently unavailable, to have access to MongoDB Atlas tools like creating clusters or connecting to clusters make sure to setup credentials, more info at 'https://github.com/mongodb-js/mongodb-mcp-server'.",
                };
                return {
                    contents: [
                        {
                            text: JSON.stringify(result),
                            mimeType: "application/json",
                            uri: uri.href,
                        },
                    ],
                };
            }
        );
    }

    private async validateConfig(): Promise<void> {
        if (this.userConfig.connectionString) {
            try {
                await this.session.connectToMongoDB(this.userConfig.connectionString, this.userConfig.connectOptions);
            } catch (error) {
                console.error(
                    "Failed to connect to MongoDB instance using the connection string from the config: ",
                    error
                );
                throw new Error("Failed to connect to MongoDB instance using the connection string from the config");
            }
        }
    }
}
