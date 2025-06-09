import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MongoDBToolBase } from "../mongodbTool.js";
import * as bson from "bson";
import { OperationType } from "../../tool.js";

export class ListDatabasesTool extends MongoDBToolBase {
    protected name = "list-databases";
    protected description = "List all databases for a MongoDB connection";
    protected argsShape = {};

    protected operationType: OperationType = "metadata";

    protected async execute(): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const dbs = (await provider.listDatabases("")).databases as { name: string; sizeOnDisk: bson.Long }[];

        const dbsFormatted = dbs.map(db => ({
            name: db.name,
            sizeOnDisk: db.sizeOnDisk.toString()
        }));

        return {
            content: [
                {
                    text: JSON.stringify(dbsFormatted, null, 2),
                    type: "text",
                },
            ],
        };
    }
}
