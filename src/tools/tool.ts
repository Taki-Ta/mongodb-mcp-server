import { z, type ZodRawShape, type ZodNever, AnyZodObject } from "zod";
import type { McpServer, RegisteredTool, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Session } from "../session.js";
import logger, { LogId } from "../logger.js";
import { Telemetry } from "../telemetry/telemetry.js";
import { type ToolEvent } from "../telemetry/types.js";
import { UserConfig } from "../config.js";

export type ToolArgs<Args extends ZodRawShape> = z.objectOutputType<Args, ZodNever>;

export type OperationType = "metadata" | "read" | "create" | "delete" | "update";
export type ToolCategory = "mongodb" | "atlas";
export type TelemetryToolMetadata = {
    projectId?: string;
    orgId?: string;
};

export abstract class ToolBase {
    protected abstract name: string;

    protected abstract category: ToolCategory;

    protected abstract operationType: OperationType;

    protected abstract description: string;

    protected abstract argsShape: ZodRawShape;

    protected abstract execute(...args: Parameters<ToolCallback<typeof this.argsShape>>): Promise<CallToolResult>;

    constructor(
        protected readonly session: Session,
        protected readonly config: UserConfig,
        protected readonly telemetry: Telemetry
    ) {}

    public register(server: McpServer): void {
        if (!this.verifyAllowed()) {
            return;
        }

        const callback: ToolCallback<typeof this.argsShape> = async (...args) => {
            const startTime = Date.now();
            try {
                logger.debug(LogId.toolInputReceived, "tool", `Tool ${this.name} received input: ${JSON.stringify(args)}`);
                
                logger.debug(LogId.toolExecute, "tool", `Executing ${this.name} with args: ${JSON.stringify(args)}`);

                const result = await this.execute(...args);
                
                this.validateAndLogOutput(result);
                
                await this.emitToolEvent(startTime, result, ...args).catch(() => {});
                return result;
            } catch (error: unknown) {
                logger.error(LogId.toolExecuteFailure, "tool", `Error executing ${this.name}: ${error as string}`);
                const toolResult = await this.handleError(error, args[0] as ToolArgs<typeof this.argsShape>);
                
                this.validateAndLogOutput(toolResult);
                
                await this.emitToolEvent(startTime, toolResult, ...args).catch(() => {});
                return toolResult;
            }
        };

        server.tool(this.name, this.description, this.argsShape, callback);

        this.update = (updates: { name?: string; description?: string; inputSchema?: AnyZodObject }) => {
            const tools = server["_registeredTools"] as { [toolName: string]: RegisteredTool };
            const existingTool = tools[this.name];

            if (updates.name && updates.name !== this.name) {
                delete tools[this.name];
                this.name = updates.name;
                tools[this.name] = existingTool;
            }

            if (updates.description) {
                existingTool.description = updates.description;
                this.description = updates.description;
            }

            if (updates.inputSchema) {
                existingTool.inputSchema = updates.inputSchema;
            }

            server.sendToolListChanged();
        };
    }

    protected update?: (updates: { name?: string; description?: string; inputSchema?: AnyZodObject }) => void;

    protected verifyAllowed(): boolean {
        let errorClarification: string | undefined;

        if (this.config.readOnly && !["read", "metadata"].includes(this.operationType)) {
            errorClarification = `read-only mode is enabled, its operation type, \`${this.operationType}\`,`;
        } else if (this.config.disabledTools.includes(this.category)) {
            errorClarification = `its category, \`${this.category}\`,`;
        } else if (this.config.disabledTools.includes(this.operationType)) {
            errorClarification = `its operation type, \`${this.operationType}\`,`;
        } else if (this.config.disabledTools.includes(this.name)) {
            errorClarification = `it`;
        }

        if (errorClarification) {
            logger.debug(
                LogId.toolDisabled,
                "tool",
                `Prevented registration of ${this.name} because ${errorClarification} is disabled in the config`
            );

            return false;
        }

        return true;
    }

    protected handleError(
        error: unknown,
        args: ToolArgs<typeof this.argsShape>
    ): Promise<CallToolResult> | CallToolResult {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        error: error instanceof Error ? error.message : String(error)
                    }, null, 2),
                },
            ],
            isError: true,
        };
    }

    protected abstract resolveTelemetryMetadata(
        ...args: Parameters<ToolCallback<typeof this.argsShape>>
    ): TelemetryToolMetadata;

    private async emitToolEvent(
        startTime: number,
        result: CallToolResult,
        ...args: Parameters<ToolCallback<typeof this.argsShape>>
    ): Promise<void> {
        if (!this.telemetry.isTelemetryEnabled()) {
            return;
        }
        const duration = Date.now() - startTime;
        const metadata = this.resolveTelemetryMetadata(...args);
        const event: ToolEvent = {
            timestamp: new Date().toISOString(),
            source: "mdbmcp",
            properties: {
                command: this.name,
                category: this.category,
                component: "tool",
                duration_ms: duration,
                result: result.isError ? "failure" : "success",
            },
        };

        if (metadata?.orgId) {
            event.properties.org_id = metadata.orgId;
        }

        if (metadata?.projectId) {
            event.properties.project_id = metadata.projectId;
        }

        await this.telemetry.emitEvents([event]);
    }

    private validateAndLogOutput(result: CallToolResult): void {
        try {
            logger.debug(LogId.toolOutputGenerated, "tool", `Tool ${this.name} generated output with ${result.content?.length || 0} content items`);
            
            if (result.content) {
                for (let i = 0; i < result.content.length; i++) {
                    const contentItem = result.content[i];
                    if (contentItem.type === "text" && contentItem.text) {
                        try {
                            JSON.parse(contentItem.text);
                            logger.debug(LogId.toolJsonValidation, "tool", `Tool ${this.name} content[${i}] JSON validation passed`);
                        } catch (jsonError) {
                            logger.error(LogId.toolJsonValidationFailure, "tool", 
                                `Tool ${this.name} content[${i}] JSON validation failed: ${jsonError}. Content: ${contentItem.text}`);
                            
                            const fixedContent = this.tryFixJsonFormat(contentItem.text);
                            if (fixedContent !== contentItem.text) {
                                logger.info(LogId.toolJsonValidation, "tool", 
                                    `Tool ${this.name} content[${i}] JSON auto-fixed`);
                                contentItem.text = fixedContent;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(LogId.toolJsonValidationFailure, "tool", 
                `Tool ${this.name} output validation failed: ${error}`);
        }
    }

    private tryFixJsonFormat(text: string): string {
        try {
            let cleaned = text.trim().replace(/[\x00-\x1f\x7f]/g, '');
            
            if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
                cleaned = `{"data": ${cleaned}}`;
            }
            
            JSON.parse(cleaned);
            return cleaned;
        } catch {
            return JSON.stringify({
                error: "Invalid JSON format",
                originalContent: text.substring(0, 200) + (text.length > 200 ? "..." : "")
            }, null, 2);
        }
    }
}
