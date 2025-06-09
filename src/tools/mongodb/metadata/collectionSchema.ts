import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { getSimplifiedSchema } from "mongodb-schema";

export class CollectionSchemaTool extends MongoDBToolBase {
    protected name = "collection-schema";
    protected description = "Describe the schema for a collection";
    protected argsShape = DbOperationArgs;

    protected operationType: OperationType = "metadata";

    protected async execute({ database, collection }: ToolArgs<typeof DbOperationArgs>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const resolvedDatabase = this.resolveDatabase(database);
        const documents = await provider.find(resolvedDatabase, collection, {}, { limit: 5 }).toArray();
        const schema = await getSimplifiedSchema(documents);

        return {
            content: [
                {
                    text: JSON.stringify(schema, undefined, 2),
                    type: "text",
                },
            ],
        };
    }
}
