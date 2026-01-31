/**
 * Context Layers - Intentional, not pattern-based
 * What AI needs to onboard quickly
 */

export interface ProjectIdentity {
  id: string;
  name: string;
  path: string;
  purpose: string;
  tech: string[];
  architecture: string;
  created_at: number;
  updated_at: number;
}

export interface ActiveWork {
  id: string;
  project_id: string;
  task: string;
  context: string;
  files: string[];
  branch?: string;
  timestamp: number;
  status: 'active' | 'paused' | 'completed';
}

export interface Constraint {
  id: string;
  project_id: string;
  key: string;
  value: string;
  reasoning: string;
  timestamp: number;
}

export interface Problem {
  id: string;
  project_id: string;
  description: string;
  context?: string;
  status: 'open' | 'investigating' | 'resolved';
  resolution?: string;
  timestamp: number;
}

export interface Goal {
  id: string;
  project_id: string;
  description: string;
  target_date?: string;
  status: 'planned' | 'in-progress' | 'blocked' | 'completed';
  timestamp: number;
}

export interface Decision {
  id: string;
  project_id: string;
  description: string;
  reasoning: string;
  alternatives?: string[];
  timestamp: number;
}

export interface Note {
  id: string;
  project_id: string;
  content: string;
  tags: string[];
  timestamp: number;
}

export interface Caveat {
  id: string;
  project_id: string;
  description: string;
  category: 'mistake' | 'shortcut' | 'unverified' | 'assumption' | 'workaround';
  severity: 'low' | 'medium' | 'high' | 'critical';
  attempted?: string;
  error?: string;
  recovery?: string;
  verified: boolean;
  action_required?: string;
  affects_production: boolean;
  timestamp: number;
  resolved: boolean;
  resolution?: string;
  resolved_at?: number;
}

export interface RecallResult {
  project: ProjectIdentity;
  active_work: ActiveWork[];
  constraints: Constraint[];
  problems: Problem[];
  goals: Goal[];
  recent_decisions: Decision[];
  notes: Note[];
  caveats: Caveat[];
}

export type RememberType = 'active_work' | 'constraint' | 'problem' | 'goal' | 'decision' | 'note' | 'caveat';

export interface RememberInput {
  type: RememberType;
  content: string;
  metadata?: Record<string, any>;
}

