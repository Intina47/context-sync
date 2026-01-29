#!/usr/bin/env node

import { ContextSyncServer } from './server.js';

async function main() {
  // Support custom database path for development/testing
  let storagePath: string | undefined;
  
  // Check for --db-path argument
  const dbPathIndex = process.argv.indexOf('--db-path');
  if (dbPathIndex !== -1 && process.argv[dbPathIndex + 1]) {
    storagePath = process.argv[dbPathIndex + 1];
    console.error(`Context Sync - Using custom database: ${storagePath}`);
  }
  // Check for environment variable
  else if (process.env.CONTEXT_SYNC_DB_PATH) {
    storagePath = process.env.CONTEXT_SYNC_DB_PATH;
    console.error(`Context Sync - Using database from env: ${storagePath}`);
  } else {
    console.error('Context Sync - 9 Essential Tools');
  }

  const server = new ContextSyncServer(storagePath);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.error('\nShutting down Context Sync...');
    server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error('\nShutting down Context Sync...');
    server.close();
    process.exit(0);
  });

  await server.run();
}

main().catch((error) => {
  console.error('Failed to start Context Sync:', error);
  process.exit(1);
});

