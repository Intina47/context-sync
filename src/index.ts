#!/usr/bin/env node

import { ContextSyncServer } from './server.js';
import * as http from 'http';
import * as path from 'path';

async function main() {
  // Support custom database path for development/testing
  // Priority: CLI argument > Environment variable > Default
  let storagePath: string | undefined;
  
  // Check for --db-path argument
  const dbPathIndex = process.argv.indexOf('--db-path');
  if (dbPathIndex !== -1 && process.argv[dbPathIndex + 1]) {
    storagePath = process.argv[dbPathIndex + 1];
    console.error(`Using custom database: ${storagePath}`);
  }
  // Check for environment variable (Docker support)
  else if (process.env.CONTEXT_SYNC_DB_PATH) {
    storagePath = process.env.CONTEXT_SYNC_DB_PATH;
    console.error(`Using database from env: ${storagePath}`);
  }
  // Docker: Use data directory if available
  else if (process.env.CONTEXT_SYNC_DATA_DIR || process.env.DATA_DIR) {
    const dataDir = process.env.CONTEXT_SYNC_DATA_DIR || process.env.DATA_DIR;
    if (dataDir) {
      storagePath = path.join(dataDir, 'context-sync.db');
      console.error(`Using Docker data directory: ${storagePath}`);
    }
  }
  // Check for --dev flag (uses dev database)
  else if (process.argv.includes('--dev')) {
    const os = require('os');
    const path = require('path');
    storagePath = path.join(os.homedir(), '.context-sync', 'dev-data.db');
    console.error(`Using development database: ${storagePath}`);
  }

  const server = new ContextSyncServer(storagePath);

  // Optional: Start health check server for Docker deployments
  let healthServer: http.Server | null = null;
  if (process.env.CONTEXT_SYNC_HEALTH_PORT) {
    const port = parseInt(process.env.CONTEXT_SYNC_HEALTH_PORT);
    
    healthServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          service: 'context-sync',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          transport: 'stdio'
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Health check endpoint only. MCP communication via stdio.');
      }
    });

    healthServer.listen(port, () => {
      console.error(`Health check server listening on port ${port}`);
      console.error('Note: MCP communication remains on stdio transport');
    });
  }

  // Handle graceful shutdown
  const shutdown = () => {
    console.error('Shutting down Context Sync...');
    
    const cleanup = () => {
      server.close();
      process.exit(0);
    };

    if (healthServer) {
      console.error('Closing health check server...');
      healthServer.close(cleanup);
    } else {
      cleanup();
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.run();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});