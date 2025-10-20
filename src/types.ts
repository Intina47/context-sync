// Core types for Context Sync

export interface ProjectContext {
  id: string;
  name: string;
  path?: string;
  architecture?: string;
  techStack: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  projectId: string;
  tool: 'claude' | 'cursor' | 'copilot' | 'other';
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Decision {
  id: string;
  projectId: string;
  type: 'architecture' | 'library' | 'pattern' | 'configuration' | 'other';
  description: string;
  reasoning?: string;
  timestamp: Date;
}

export interface ContextSummary {
  project: ProjectContext;
  recentDecisions: Decision[];
  recentConversations: Conversation[];
  keyPoints: string[];
}

export interface StorageInterface {
  // Projects
  createProject(name: string, path?: string): ProjectContext;
  getProject(id: string): ProjectContext | null;
  getCurrentProject(): ProjectContext | null;
  updateProject(id: string, updates: Partial<ProjectContext>): void;
  
  // Conversations
  addConversation(conv: Omit<Conversation, 'id' | 'timestamp'>): Conversation;
  getRecentConversations(projectId: string, limit?: number): Conversation[];
  
  // Decisions
  addDecision(decision: Omit<Decision, 'id' | 'timestamp'>): Decision;
  getDecisions(projectId: string): Decision[];
  
  // Context
  getContextSummary(projectId: string): ContextSummary;

  findProjectByPath(projectPath: string): ProjectContext | null;
}