import { createContextEngine } from '../src/context-engine/index.js';

(async () => {
  const workspace = process.cwd();
  console.log('Workspace:', workspace);

  const engine = createContextEngine(workspace);

  // Listen for extractor events
  engine.extractor.on('context-extracted', (payload: any) => {
    console.log('EVENT: context-extracted ->', payload && payload.path ? payload.path : payload);
  });

  engine.extractor.on('context-item-extracted', (item: any) => {
    console.log('EVENT: context-item-extracted ->', item.type, item.source, (item.metadata && item.metadata.files) || []);
  });

  engine.extractor.on('warning', (w: any) => console.warn('WARNING:', w));
  engine.extractor.on('error', (e: any) => console.error('ERROR:', e));
  engine.extractor.on('extraction-error', (e: any) => console.error('EXTRACTION-ERROR:', e));

  // Also listen for autopilot events
  if (engine.autopilot) {
    engine.autopilot.on('autopilot-enabled', () => console.log('Autopilot enabled'));
    engine.autopilot.on('git-watcher-started', (info: any) => console.log('Git watcher started', info));
    engine.autopilot.on('context-compressed', (r: any) => console.log('context-compressed', r));
  }

  // Wait for a few seconds to allow initial scan
  await new Promise(resolve => setTimeout(resolve, 6000));
  console.log('Test run complete.');
  process.exit(0);
})();