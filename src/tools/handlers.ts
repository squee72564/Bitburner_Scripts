import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BitburnerClient } from '../bitburner/client';
import { RemoteApiError } from '../bitburner/types';
import type { Config } from '../config';
import { Logger } from '../logger';
import {
  calculateRamOutputSchema,
  definitionFileOutputSchema,
  emptyInputSchema,
  filenameInputSchema,
  getAllFilesOutputSchema,
  listFilesOutputSchema,
  readFileOutputSchema,
  serverInputSchema,
} from './schemas';
import { assertFilename, normalizeServer } from './validators';

function toMcpError(error: unknown): McpError {
  if (error instanceof McpError) return error;
  if (error instanceof RemoteApiError) {
    return new McpError(ErrorCode.InternalError, error.message, {
      code: error.code,
      data: error.data,
    });
  }
  if (error instanceof Error) {
    if (error.message.includes('disconnected')) {
      return new McpError(ErrorCode.ConnectionClosed, error.message);
    }
    if (error.message.includes('timeout')) {
      return new McpError(ErrorCode.RequestTimeout, error.message);
    }
    if (error.message.includes('filename') || error.message.includes('content')) {
      return new McpError(ErrorCode.InvalidParams, error.message);
    }
    return new McpError(ErrorCode.InternalError, error.message);
  }
  return new McpError(ErrorCode.InternalError, 'Unknown error');
}

function toResponse<T>(result: T) {
  return {
    structuredContent: { result },
    content: [
      {
        type: 'text' as const,
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      },
    ],
  };
}

export function registerTools(
  server: McpServer,
  client: BitburnerClient,
  config: Config,
  logger: Logger,
): void {
  server.registerTool(
    'list_files',
    {
      description: 'List files on a Bitburner server',
      inputSchema: serverInputSchema,
      outputSchema: listFilesOutputSchema,
    },
    async (input) => {
      try {
        const serverName = normalizeServer(input.server);
        const result = await client.getFileNames(serverName);
        return toResponse(result);
      } catch (error) {
        logger.warn('list_files failed', { error: (error as Error).message });
        throw toMcpError(error);
      }
    },
  );

  server.registerTool(
    'read_file',
    {
      description: 'Read a file from a Bitburner server',
      inputSchema: filenameInputSchema,
      outputSchema: readFileOutputSchema,
    },
    async (input) => {
      try {
        assertFilename(input.filename);
        const serverName = normalizeServer(input.server);
        const result = await client.getFile(input.filename, serverName);
        return toResponse(result);
      } catch (error) {
        logger.warn('read_file failed', { error: (error as Error).message });
        throw toMcpError(error);
      }
    },
  );

  server.registerTool(
    'get_all_files',
    {
      description: 'Get all files from a Bitburner server',
      inputSchema: serverInputSchema,
      outputSchema: getAllFilesOutputSchema,
    },
    async (input) => {
      try {
        const serverName = normalizeServer(input.server);
        const result = await client.getAllFiles(serverName);
        return toResponse(result);
      } catch (error) {
        logger.warn('get_all_files failed', { error: (error as Error).message });
        throw toMcpError(error);
      }
    },
  );

  server.registerTool(
    'calculate_ram',
    {
      description: 'Calculate RAM usage of a script',
      inputSchema: filenameInputSchema,
      outputSchema: calculateRamOutputSchema,
    },
    async (input) => {
      try {
        assertFilename(input.filename);
        const serverName = normalizeServer(input.server);
        const result = await client.calculateRam(input.filename, serverName);
        return toResponse(result);
      } catch (error) {
        logger.warn('calculate_ram failed', { error: (error as Error).message });
        throw toMcpError(error);
      }
    },
  );

  server.registerTool(
    'get_netscript_definitions',
    {
      description: 'Fetch Netscript TypeScript definitions',
      inputSchema: emptyInputSchema,
      outputSchema: definitionFileOutputSchema,
    },
    async () => {
      try {
        const result = await client.getDefinitionFile();
        return toResponse(result);
      } catch (error) {
        logger.warn('get_netscript_definitions failed', { error: (error as Error).message });
        throw toMcpError(error);
      }
    },
  );
}
