/**
 * Context Engine - Intelligent context management
 * 
 * This is the core of Context Sync v7's "context engineering" capabilities
 * that makes manual .md context files obsolete.
 */

// Export from relevance-scorer
export { 
  RelevanceScorer, 
  createRelevanceScorer,
  type ContextItem,
  type RelevanceScore,
  type ScoringContext 
} from './relevance-scorer.js';

// Export from context-compressor
export { 
  ContextCompressor, 
  createContextCompressor,
  type CompressionStrategy,
  type CompressionResult 
} from './context-compressor.js';

// Export from auto-extractor
export { 
  AutoContextExtractor, 
  createAutoContextExtractor,
  type ExtractedContext 
} from './auto-extractor.js';

// Export from health-monitor
export { 
  ContextHealthMonitor, 
  createContextHealthMonitor,
  type ContextHealth,
  type HealthIssue 
} from './health-monitor.js';

// Export from context-autopilot
export { 
  ContextAutopilot, 
  createContextAutopilot,
  type AutopilotConfig 
} from './context-autopilot.js';

// Import what we need for the factory function
import { createContextAutopilot, AutopilotConfig } from './context-autopilot.js';
import { createRelevanceScorer } from './relevance-scorer.js';
import { createContextCompressor } from './context-compressor.js';
import { createAutoContextExtractor } from './auto-extractor.js';
import { createContextHealthMonitor } from './health-monitor.js';
import { Storage } from '../storage.js';
import { wirePersistence } from './persistence.js';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Quick start: Create a fully configured context engine
 */
export interface EngineOptions {
  autopilotConfig?: Partial<AutopilotConfig>;
  autostartAutopilot?: boolean;
  storagePath?: string;
}

export function createContextEngine(workspacePath: string, options: EngineOptions = {}) {
  const { autopilotConfig } = options;

  // Autostart behavior precedence:
  // 1. If options.autostartAutopilot is explicitly true/false, honor it.
  // 2. Else, if user config exists (~/.context-sync/config.json) with an explicit boolean, use it.
  // 3. Else default to true so the autopilot runs by default for installed servers.
  let autostartAutopilot: boolean = true;
  if (typeof options.autostartAutopilot === 'boolean') {
    autostartAutopilot = options.autostartAutopilot;
  } else {
    try {
      const cfgPath = path.join(os.homedir(), '.context-sync', 'config.json');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        if (cfg && typeof cfg.autostartAutopilot === 'boolean') {
          autostartAutopilot = cfg.autostartAutopilot;
        }
      }
    } catch (err) {
      // ignore config read errors and keep default true
    }
  }

  // Create persistent storage and wire it to components
  const storage = options.storagePath ? new Storage(options.storagePath) : new Storage();

  const autopilot = createContextAutopilot(workspacePath, autopilotConfig, storage);
  const scorer = createRelevanceScorer();
  const compressor = createContextCompressor();
  const extractor = createAutoContextExtractor();
  const healthMonitor = createContextHealthMonitor();

  // Wire persistence: store extracted contexts into SQLite
  try {
    wirePersistence(extractor, storage, workspacePath);
  } catch (err) {
    // non-fatal - persistence errors emitted by extractor
  }

  // Start an initial auto-watch/extraction in the background so "auto" mode
  // is useful immediately for callers that instantiate the engine.
  (async () => {
    try {
      await extractor.autoWatchProject(workspacePath);
    } catch (err) {
      // emit or ignore: extractor already emits warnings/errors where appropriate
    }

    // Optionally auto-start the autopilot (opt-in): heavy tasks like git polling
    // and scheduled health checks are started only if requested.
    if (autostartAutopilot) {
      try {
        await autopilot.start();
      } catch (err) {
        // emit or ignore
      }
    }
  })();

  return {
    autopilot,
    scorer,
    compressor,
    extractor,
    healthMonitor,
  };
}