import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { z } from "zod";

export const CountArgs = {
    query: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
            "The query filter to count documents. Matches the syntax of the filter argument of db.collection.count()"
        ),
};

export class CountTool extends MongoDBToolBase {
    protected name = "count";
    protected description = "Gets the number of documents in a MongoDB collection";
    protected argsShape = {
        ...DbOperationArgs,
        ...CountArgs,
    };

    protected operationType: OperationType = "read";

    protected async execute({ database, collection, query }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const resolvedDatabase = this.resolveDatabase(database);
        const count = await provider.count(resolvedDatabase, collection, query);

        return {
            content: [
                {
                    text: JSON.stringify({ count }, null, 2),
                    type: "text",
                },
            ],
        };
    }
}
