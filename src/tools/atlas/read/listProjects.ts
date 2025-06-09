import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "../atlasTool.js";
import { OperationType } from "../../tool.js";
import { z } from "zod";
import { ToolArgs } from "../../tool.js";

export class ListProjectsTool extends AtlasToolBase {
    protected name = "atlas-list-projects";
    protected description = "List MongoDB Atlas projects";
    protected operationType: OperationType = "read";
    protected argsShape = {
        orgId: z.string().describe("Atlas organization ID to filter projects").optional(),
    };

    protected async execute({ orgId }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const orgData = await this.session.apiClient.listOrganizations();

        if (!orgData?.results?.length) {
            throw new Error("No organizations found in your MongoDB Atlas account.");
        }

        const orgs: Record<string, string> = orgData.results
            .map((org) => [org.id || "", org.name])
            .reduce((acc, [id, name]) => ({ ...acc, [id]: name }), {});

        const data = orgId
            ? await this.session.apiClient.listOrganizationProjects({
                  params: {
                      path: {
                          orgId,
                      },
                  },
              })
            : await this.session.apiClient.listProjects();

        if (!data?.results?.length) {
            throw new Error("No projects found in your MongoDB Atlas account.");
        }

        const projects = data.results.map((project) => ({
            name: project.name,
            id: project.id,
            organizationName: orgs[project.orgId],
            organizationId: project.orgId,
            createdAt: project.created ? new Date(project.created).toISOString() : null
        }));

        return {
            content: [{ type: "text", text: JSON.stringify(projects, undefined, 2) }],
        };
    }
}
