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
  tool: 'claude' | 'cursor' | 'copilot' | 'ollama' | 'openai' | 'anthropic' | 'continue' | 'codeium' | 'tabnine' | 'windsurf' | 'zed' | 'notion' | 'gemini' | 'codewisperer' | 'other';
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

export interface Learning {
  id: string;
  projectId: string;
  insight: string;
  context?: string;
  confidence?: number;
  timestamp: Date;
}

export interface ProblemSolution {
  id: string;
  projectId: string;
  problem: string;
  solution: string;
  confidence?: number;
  timestamp: Date;
}

export interface Comparison {
  id: string;
  projectId: string;
  optionA: string;
  optionB: string;
  winner?: string;
  reasoning?: string;
  confidence?: number;
  timestamp: Date;
}

export interface AntiPattern {
  id: string;
  projectId: string;
  description: string;
  why: string;
  confidence?: number;
  timestamp: Date;
}

export interface ContextSummary {
  project: ProjectContext;
  recentDecisions: Decision[];
  recentConversations: Conversation[];
  recentLearnings?: Learning[];
  recentProblems?: ProblemSolution[];
  keyPoints: string[];
}

export interface StorageInterface {
  // Projects
  createProject(name: string, path?: string): ProjectContext;
  getProject(id: string): ProjectContext | null;
  /** @deprecated Use session-based current project in ContextSyncServer instead */
  getCurrentProject(): ProjectContext | null;
  /** @deprecated Use session-based current project in ContextSyncServer instead */
  setCurrentProject(projectId: string): void;
  updateProject(id: string, updates: Partial<ProjectContext>): void;
  
  // Conversations
  addConversation(conv: Omit<Conversation, 'id' | 'timestamp'>): Conversation;
  getRecentConversations(projectId: string, limit?: number): Conversation[];
  streamConversations(projectId: string, limit?: number): Generator<Conversation>;
  
  // Decisions
  addDecision(decision: Omit<Decision, 'id' | 'timestamp'>): Decision;
  getDecisions(projectId: string): Decision[];
  streamDecisions(projectId: string, limit?: number): Generator<Decision>;
  
  // Learnings
  addLearning(learning: Omit<Learning, 'id' | 'timestamp'>): Learning;
  getLearnings(projectId: string, limit?: number): Learning[];
  
  // Problem Solutions
  addProblemSolution(problem: Omit<ProblemSolution, 'id' | 'timestamp'>): ProblemSolution;
  getProblemSolutions(projectId: string, limit?: number): ProblemSolution[];
  
  // Comparisons
  addComparison(comparison: Omit<Comparison, 'id' | 'timestamp'>): Comparison;
  getComparisons(projectId: string, limit?: number): Comparison[];
  
  // Anti-patterns
  addAntiPattern(antiPattern: Omit<AntiPattern, 'id' | 'timestamp'>): AntiPattern;
  getAntiPatterns(projectId: string, limit?: number): AntiPattern[];
  
  // Projects streaming
  streamAllProjects(): Generator<ProjectContext>;
  
  // Context
  getContextSummary(projectId: string): ContextSummary;

  findProjectByPath(projectPath: string): ProjectContext | null;
}