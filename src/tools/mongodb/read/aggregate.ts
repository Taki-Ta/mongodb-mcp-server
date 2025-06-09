import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { EJSON } from "bson";

export const AggregateArgs = {
    pipeline: z.array(z.record(z.string(), z.unknown())).describe("An array of aggregation stages to execute"),
};

export class AggregateTool extends MongoDBToolBase {
    protected name = "aggregate";
    protected description = "Run an aggregation against a MongoDB collection";
    protected argsShape = {
        ...DbOperationArgs,
        ...AggregateArgs,
    };
    protected operationType: OperationType = "read";

    protected async execute({
        database,
        collection,
        pipeline,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const resolvedDatabase = this.resolveDatabase(database);
        const documents = await provider.aggregate(resolvedDatabase, collection, pipeline).toArray();

        return {
            content: [
                {
                    text: EJSON.stringify(documents),
                    type: "text",
                }
            ],
        };
    }
}
