import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "../atlasTool.js";
import { OperationType } from "../../tool.js";

export class ListOrganizationsTool extends AtlasToolBase {
    protected name = "atlas-list-orgs";
    protected description = "List MongoDB Atlas organizations";
    protected operationType: OperationType = "read";
    protected argsShape = {};

    protected async execute(): Promise<CallToolResult> {
        const data = await this.session.apiClient.listOrganizations();

        if (!data?.results?.length) {
            throw new Error("No organizations found in your MongoDB Atlas account.");
        }

        const organizations = data.results.map((org) => ({
            name: org.name,
            id: org.id
        }));

        return {
            content: [{ type: "text", text: JSON.stringify(organizations, undefined, 2) }],
        };
    }
}
