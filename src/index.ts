import 'dotenv/config';
import { loadConfig } from './config';
import { BitburnerClient } from './bitburner/client';
import { Logger } from './logger';
import { startMcpServer } from './mcp/server';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);

  logger.info('Starting Bitburner MCP server', {
    rpcUrl: config.rpcUrl,
    fileWriteMaxBytes: config.fileWriteMaxBytes,
  });

  const client = new BitburnerClient(
    {
      url: config.rpcUrl,
      timeoutMs: config.rpcTimeoutMs,
      reconnectBaseMs: config.rpcReconnectBaseMs,
      reconnectMaxMs: config.rpcReconnectMaxMs,
    },
    logger,
  );

  client.start().catch((err) => {
    logger.warn('Initial connection failed', { error: err.message });
  });

  await startMcpServer(client, config, logger);

  const shutdown = async () => {
    logger.info('Shutting down');
    await client.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
