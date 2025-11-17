#!/usr/bin/env node

import { ContextSyncServer } from './server.js';

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
  // Check for environment variable
  else if (process.env.CONTEXT_SYNC_DB_PATH) {
    storagePath = process.env.CONTEXT_SYNC_DB_PATH;
    console.error(`Using database from env: ${storagePath}`);
  }
  // Check for --dev flag (uses dev database)
  else if (process.argv.includes('--dev')) {
    const os = require('os');
    const path = require('path');
    storagePath = path.join(os.homedir(), '.context-sync', 'dev-data.db');
    console.error(`Using development database: ${storagePath}`);
  }

  const server = new ContextSyncServer(storagePath);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.close();
    process.exit(0);
  });

  await server.run();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});