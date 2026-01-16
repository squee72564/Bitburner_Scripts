import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { BitburnerClient } from "../bitburner/client";
import type { Config } from "../config";
import { Logger } from "../logger";
import { registerTools } from "../tools/handlers";

export async function startMcpServer(
  client: BitburnerClient,
  config: Config,
  logger: Logger
): Promise<McpServer> {
  const server = new McpServer({
    name: "bitburner-mcp-server",
    version: "1.0.0",
  });

  registerTools(server, client, config, logger);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server running on stdio");

  return server;
}
