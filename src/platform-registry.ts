/**
 * Platform Registry - Metadata about supported AI platforms
 */

import type { AIPlatform } from './platform-sync.js';

export interface PlatformMetadata {
  name: string;
  category: 'core' | 'extended' | 'api';
  description: string;
  website: string;
  setupComplexity: 'easy' | 'medium' | 'advanced';
  mcpSupport: 'native' | 'extension' | 'custom';
  status: 'stable' | 'beta' | 'experimental';
  features: string[];
}

export const PLATFORM_REGISTRY: Record<AIPlatform, PlatformMetadata> = {
  claude: {
    name: 'Claude Desktop',
    category: 'core',
    description: 'Anthropic\'s desktop app with native MCP support',
    website: 'https://claude.ai/desktop',
    setupComplexity: 'easy',
    mcpSupport: 'native',
    status: 'stable',
    features: ['Advanced reasoning', 'Code analysis', 'Long context', 'File operations']
  },
  
  cursor: {
    name: 'Cursor IDE',
    category: 'core', 
    description: 'AI-first code editor with built-in AI assistance',
    website: 'https://cursor.sh',
    setupComplexity: 'easy',
    mcpSupport: 'native',
    status: 'stable',
    features: ['Real-time coding', 'Codebase chat', 'AI editing', 'Terminal integration']
  },
  
  copilot: {
    name: 'GitHub Copilot',
    category: 'core',
    description: 'GitHub\'s AI pair programmer for VS Code',
    website: 'https://github.com/features/copilot',
    setupComplexity: 'medium',
    mcpSupport: 'extension',
    status: 'stable', 
    features: ['Code completion', 'Chat interface', 'PR analysis', 'Enterprise features']
  },
  
  continue: {
    name: 'Continue.dev',
    category: 'extended',
    description: 'Open source AI coding assistant for VS Code',
    website: 'https://continue.dev',
    setupComplexity: 'medium',
    mcpSupport: 'native',
    status: 'stable',
    features: ['Open source', 'Custom models', 'Self-hosted', 'Extensible']
  },
  
  zed: {
    name: 'Zed Editor',
    category: 'extended',
    description: 'High-performance collaborative code editor',
    website: 'https://zed.dev',
    setupComplexity: 'medium',
    mcpSupport: 'extension',
    status: 'beta',
    features: ['Fast performance', 'Collaboration', 'AI integration', 'Modern UI']
  },
  
  windsurf: {
    name: 'Windsurf by Codeium',
    category: 'extended',
    description: 'AI-native IDE by Codeium with integrated AI assistant',
    website: 'https://windsurf.codeium.com',
    setupComplexity: 'easy',
    mcpSupport: 'native',
    status: 'beta',
    features: ['AI-native design', 'Codeium integration', 'Modern interface', 'Fast setup', 'Free tier available']
  },
  
  tabnine: {
    name: 'TabNine',
    category: 'extended',
    description: 'Enterprise-focused AI code completion',
    website: 'https://tabnine.com',
    setupComplexity: 'medium',
    mcpSupport: 'extension',
    status: 'stable',
    features: ['Enterprise focus', 'On-premise deployment', 'Security compliance', 'Team management']
  },

  
  other: {
    name: 'Other Platform',
    category: 'api',
    description: 'Custom or unsupported platform',
    website: 'https://github.com/Intina47/context-sync',
    setupComplexity: 'advanced',
    mcpSupport: 'custom',
    status: 'experimental',
    features: ['Custom integration', 'Community support', 'Experimental']
  }
};

/**
 * Get platforms by category
 */
export function getPlatformsByCategory(category: PlatformMetadata['category']): AIPlatform[] {
  return Object.entries(PLATFORM_REGISTRY)
    .filter(([_, meta]) => meta.category === category)
    .map(([platform, _]) => platform as AIPlatform);
}

/**
 * Get recommended platforms for new users
 */
export function getRecommendedPlatforms(): AIPlatform[] {
  return Object.entries(PLATFORM_REGISTRY)
    .filter(([_, meta]) => meta.setupComplexity === 'easy' && meta.status === 'stable')
    .map(([platform, _]) => platform as AIPlatform);
}

/**
 * Get platform setup difficulty
 */
export function getPlatformsByDifficulty(difficulty: PlatformMetadata['setupComplexity']): AIPlatform[] {
  return Object.entries(PLATFORM_REGISTRY)
    .filter(([_, meta]) => meta.setupComplexity === difficulty)
    .map(([platform, _]) => platform as AIPlatform);
}