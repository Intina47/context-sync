// Manual test script to verify storage works
// Run with: tsx test.ts

import { Storage } from './src/storage.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB = './test-data.db';

async function runTests() {
  console.log('🧪 Running Context Sync Tests\n');
  
  // Clean up old test db
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }

  const storage = new Storage(TEST_DB);

  try {
    // Test 1: Create a project
    console.log('Test 1: Create Project');
    const project = storage.createProject('test-app', '/path/to/test-app');
    console.log('✓ Project created:', project.name);
    console.log('  ID:', project.id);
    console.log('');

    // Test 2: Update project
    console.log('Test 2: Update Project');
    storage.updateProject(project.id, {
      architecture: 'Next.js 14 + TypeScript',
      techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Zustand'],
    });
    
    const updated = storage.getProject(project.id);
    console.log('✓ Project updated');
    console.log('  Architecture:', updated?.architecture);
    console.log('  Tech Stack:', updated?.techStack.join(', '));
    console.log('');

    // Test 3: Add decisions
    console.log('Test 3: Add Decisions');
    storage.addDecision({
      projectId: project.id,
      type: 'library',
      description: 'Using Zustand for state management',
      reasoning: 'Simpler than Redux, less boilerplate',
    });
    
    storage.addDecision({
      projectId: project.id,
      type: 'architecture',
      description: 'Using App Router instead of Pages Router',
      reasoning: 'Better for RSC and latest Next.js features',
    });
    
    console.log('✓ 2 decisions added');
    console.log('');

    // Test 4: Add conversations
    console.log('Test 4: Add Conversations');
    storage.addConversation({
      projectId: project.id,
      tool: 'claude',
      role: 'user',
      content: 'How should I structure my Zustand store?',
    });
    
    storage.addConversation({
      projectId: project.id,
      tool: 'claude',
      role: 'assistant',
      content: 'For Zustand, I recommend creating separate slices...',
    });
    
    console.log('✓ 2 conversations added');
    console.log('');

    // Test 5: Get context summary
    console.log('Test 5: Get Context Summary');
    const summary = storage.getContextSummary(project.id);
    console.log('✓ Context summary retrieved');
    console.log('  Project:', summary.project.name);
    console.log('  Decisions:', summary.recentDecisions.length);
    console.log('  Conversations:', summary.recentConversations.length);
    console.log('  Key Points:', summary.keyPoints.length);
    console.log('');
    
    console.log('Key Points:');
    summary.keyPoints.forEach((point, i) => {
      console.log(`  ${i + 1}. ${point}`);
    });
    console.log('');

    // Test 6: Get current project
    console.log('Test 6: Get Current Project');
    const current = storage.getCurrentProject();
    console.log('✓ Current project:', current?.name);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests passed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Test database created at:', TEST_DB);
    console.log('You can inspect it with: sqlite3 ' + TEST_DB);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    storage.close();
  }
}

runTests();