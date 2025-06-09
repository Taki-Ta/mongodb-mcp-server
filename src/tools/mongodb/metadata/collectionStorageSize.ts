import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";

export class CollectionStorageSizeTool extends MongoDBToolBase {
    protected name = "collection-storage-size";
    protected description = "Gets the size of the collection";
    protected argsShape = DbOperationArgs;

    protected operationType: OperationType = "metadata";

    protected async execute({ database, collection }: ToolArgs<typeof DbOperationArgs>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const resolvedDatabase = this.resolveDatabase(database);
        const [{ value }] = (await provider
            .aggregate(resolvedDatabase, collection, [
                { $collStats: { storageStats: {} } },
                { $group: { _id: null, value: { $sum: "$storageStats.size" } } },
            ])
            .toArray()) as [{ value: number }];

        const { units, value: scaledValue } = CollectionStorageSizeTool.getStats(value);

        return {
            content: [
                {
                    text: JSON.stringify({
                        sizeBytes: value,
                        size: scaledValue,
                        units: units
                    }, null, 2),
                    type: "text",
                },
            ],
        };
    }

    protected handleError(
        error: unknown,
        args: ToolArgs<typeof this.argsShape>
    ): Promise<CallToolResult> | CallToolResult {
        if (error instanceof Error && "codeName" in error && error.codeName === "NamespaceNotFound") {
            return {
                content: [
                    {
                        text: JSON.stringify({ error: "Collection not found" }, null, 2),
                        type: "text",
                    },
                ],
            };
        }

        return super.handleError(error, args);
    }

    private static getStats(value: number): { value: number; units: string } {
        const kb = 1024;
        const mb = kb * 1024;
        const gb = mb * 1024;

        if (value > gb) {
            return { value: value / gb, units: "GB" };
        }

        if (value > mb) {
            return { value: value / mb, units: "MB" };
        }
        if (value > kb) {
            return { value: value / kb, units: "KB" };
        }
        return { value, units: "bytes" };
    }
}
