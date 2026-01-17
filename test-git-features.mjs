#!/usr/bin/env node
/**
 * Test the new git intelligence features
 */

import { GitIntegration } from './dist/git-integration.js';

const git = new GitIntegration('c:\\Users\\mamba\\context-sync');

console.log('🔥 Testing Git Hotspots...\n');
const hotspots = git.getHotspots(10);
if (hotspots && hotspots.length > 0) {
  console.log('Found', hotspots.length, 'hotspots:\n');
  for (const spot of hotspots.slice(0, 5)) {
    const icon = spot.risk === 'critical' ? '🔴' : spot.risk === 'high' ? '🟠' : spot.risk === 'medium' ? '🟡' : '🟢';
    console.log(`${icon} ${spot.file} (${spot.risk})`);
    console.log(`   ${spot.changes} changes, last: ${spot.lastChanged}\n`);
  }
} else {
  console.log('No hotspots found\n');
}

console.log('\n🔗 Testing File Coupling...\n');
const coupling = git.getFileCoupling(3);
if (coupling && coupling.length > 0) {
  console.log('Found', coupling.length, 'couplings:\n');
  for (const c of coupling.slice(0, 5)) {
    const icon = c.coupling === 'strong' ? '🔴' : c.coupling === 'medium' ? '🟡' : '🟢';
    console.log(`${icon} ${c.coupling} coupling (${c.timesChanged}× together)`);
    console.log(`   ${c.fileA}`);
    console.log(`   ${c.fileB}\n`);
  }
} else {
  console.log('No couplings found\n');
}

console.log('\n👤 Testing Blame (storage.ts - existing committed file)...\n');
const blame = git.getBlame('src/storage.ts');
if (blame && blame.length > 0) {
  console.log('Ownership breakdown:\n');
  for (const owner of blame) {
    const bar = '█'.repeat(Math.floor(owner.percentage / 5)) + '░'.repeat(20 - Math.floor(owner.percentage / 5));
    console.log(`${owner.author} - ${owner.percentage}%`);
    console.log(`${bar}`);
    console.log(`${owner.lines} lines, last edit: ${owner.lastEdit}\n`);
  }
} else {
  console.log('No blame info found\n');
}

console.log('\n📊 Testing Comprehensive Analysis...\n');
const analysis = git.getAnalysis();
if (analysis) {
  console.log('Branch:', analysis.branchHealth.current);
  console.log('Behind:', analysis.branchHealth.behind, 'Ahead:', analysis.branchHealth.ahead);
  console.log('Stale:', analysis.branchHealth.stale ? 'YES ⚠️' : 'No');
  console.log('\nTop 3 Contributors:');
  for (const c of analysis.contributors.slice(0, 3)) {
    console.log(`  ${c.name} - ${c.commits} commits (${c.lastCommit})`);
  }
  console.log('\nTop 3 Hotspots:');
  for (const h of analysis.hotspots.slice(0, 3)) {
    console.log(`  ${h.file} - ${h.changes} changes (${h.risk})`);
  }
  console.log('\nTop 3 Couplings:');
  for (const c of analysis.coupling.slice(0, 3)) {
    console.log(`  ${c.fileA} ↔ ${c.fileB} (${c.timesChanged}×)`);
  }
} else {
  console.log('Analysis failed\n');
}

console.log('\n✅ All tests complete!');
