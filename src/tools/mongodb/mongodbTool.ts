import { z } from "zod";
import { ToolArgs, ToolBase, ToolCategory, TelemetryToolMetadata } from "../tool.js";
import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCodes, MongoDBError } from "../../errors.js";
import logger, { LogId } from "../../logger.js";

export const DbOperationArgs = {
    database: z.string().describe("Database name").optional(),
    collection: z.string().describe("Collection name"),
};

export abstract class MongoDBToolBase extends ToolBase {
    protected category: ToolCategory = "mongodb";

    protected getDefaultDatabase(): string {
        // 优先从环境变量 MDB_DB 获取，然后从配置获取，最后使用默认值
        return process.env.MDB_DB || this.config.defaultDatabase || "ChatBI";
    }

    protected resolveDatabase(providedDatabase?: string): string {
        return providedDatabase || this.getDefaultDatabase();
    }

    protected async ensureConnected(): Promise<NodeDriverServiceProvider> {
        if (!this.session.serviceProvider && this.config.connectionString) {
            try {
                await this.connectToMongoDB(this.config.connectionString);
            } catch (error) {
                logger.error(
                    LogId.mongodbConnectFailure,
                    "mongodbTool",
                    `Failed to connect to MongoDB instance using the connection string from the config: ${error as string}`
                );
                throw new MongoDBError(ErrorCodes.MisconfiguredConnectionString, "Not connected to MongoDB.");
            }
        }

        if (!this.session.serviceProvider) {
            throw new MongoDBError(ErrorCodes.NotConnectedToMongoDB, "Not connected to MongoDB");
        }

        return this.session.serviceProvider;
    }

    protected handleError(
        error: unknown,
        args: ToolArgs<typeof this.argsShape>
    ): Promise<CallToolResult> | CallToolResult {
        if (error instanceof MongoDBError) {
            switch (error.code) {
                case ErrorCodes.NotConnectedToMongoDB:
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    error: "Not connected to MongoDB",
                                    message: "You need to connect to a MongoDB instance before you can access its data."
                                }, null, 2),
                            },
                        ],
                        isError: true,
                    };
                case ErrorCodes.MisconfiguredConnectionString:
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    error: "Invalid connection string",
                                    message: "The configured connection string is not valid."
                                }, null, 2),
                            },
                        ],
                        isError: true,
                    };
            }
        }

        return super.handleError(error, args);
    }

    protected connectToMongoDB(connectionString: string): Promise<void> {
        return this.session.connectToMongoDB(connectionString, this.config.connectOptions);
    }

    protected resolveTelemetryMetadata(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        args: ToolArgs<typeof this.argsShape>
    ): TelemetryToolMetadata {
        const metadata: TelemetryToolMetadata = {};

        // Add projectId to the metadata if running a MongoDB operation to an Atlas cluster
        if (this.session.connectedAtlasCluster?.projectId) {
            metadata.projectId = this.session.connectedAtlasCluster.projectId;
        }

        return metadata;
    }
}
