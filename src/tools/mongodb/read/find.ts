import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { SortDirection } from "mongodb";
import { EJSON } from "bson";

export const FindArgs = {
    filter: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("The query filter, matching the syntax of the query argument of db.collection.find()"),
    projection: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("The projection, matching the syntax of the projection argument of db.collection.find()"),
    limit: z.number().optional().default(10).describe("The maximum number of documents to return"),
    sort: z
        .record(z.string(), z.custom<SortDirection>())
        .optional()
        .describe("A document, describing the sort order, matching the syntax of the sort argument of cursor.sort()"),
};

export class FindTool extends MongoDBToolBase {
    protected name = "find";
    protected description = "Run a find query against a MongoDB collection";
    protected argsShape = {
        ...DbOperationArgs,
        ...FindArgs,
    };
    protected operationType: OperationType = "read";

    protected async execute({
        database,
        collection,
        filter,
        projection,
        limit,
        sort,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const resolvedDatabase = this.resolveDatabase(database);
        const documents = await provider.find(resolvedDatabase, collection, filter, { projection, limit, sort }).toArray();

        return {
            content: [
                {
                    text: JSON.stringify(documents, null, 2),
                    type: "text",
                }
            ],
        };
    }
}
