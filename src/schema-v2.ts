/**
 * Database schema update for v2.0 - Context Layers
 * Adds new tables for intentional context capture
 */

import Database from 'better-sqlite3';

export function migrateToV2(db: Database.Database): void {
  console.log('📦 Migrating database to v2.0 schema...');

  // Create new context layer tables
  db.exec(`
    -- Enhanced Project Identity fields (extends projects table)
    CREATE TABLE IF NOT EXISTS project_dependencies (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      critical INTEGER NOT NULL DEFAULT 0, -- boolean
      dev INTEGER NOT NULL DEFAULT 0, -- boolean
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS project_build_system (
      project_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      commands TEXT NOT NULL, -- JSON
      config_file TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS project_test_framework (
      project_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pattern TEXT NOT NULL,
      config_file TEXT,
      coverage INTEGER, -- percentage
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS project_env_vars (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      var_name TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0, -- boolean
      example_value TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS project_services (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      port INTEGER,
      protocol TEXT NOT NULL,
      health_check TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS project_databases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      connection_var TEXT,
      migrations INTEGER NOT NULL DEFAULT 0, -- boolean
      migrations_path TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS project_metrics (
      project_id TEXT PRIMARY KEY,
      lines_of_code INTEGER NOT NULL,
      file_count INTEGER NOT NULL,
      last_commit TEXT,
      contributors INTEGER NOT NULL,
      hotspots TEXT, -- JSON array
      complexity TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Active Work table
    CREATE TABLE IF NOT EXISTS active_work (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task TEXT NOT NULL,
      context TEXT,
      files TEXT, -- JSON array of file paths
      branch TEXT,
      timestamp INTEGER NOT NULL,
      status TEXT CHECK(status IN ('active', 'paused', 'completed')) DEFAULT 'active',
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Constraints table (architectural rules)
    CREATE TABLE IF NOT EXISTS constraints (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      reasoning TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Problems table (blockers/issues)
    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      description TEXT NOT NULL,
      context TEXT,
      status TEXT CHECK(status IN ('open', 'investigating', 'resolved')) DEFAULT 'open',
      resolution TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Goals table
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      description TEXT NOT NULL,
      target_date TEXT,
      status TEXT CHECK(status IN ('planned', 'in-progress', 'blocked', 'completed')) DEFAULT 'planned',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Notes table (general important info)
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT, -- JSON array of tags
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Caveats table (AI mistakes, tech debt, unverified changes)
    CREATE TABLE IF NOT EXISTS caveats (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT CHECK(category IN ('mistake', 'shortcut', 'unverified', 'assumption', 'workaround')) NOT NULL,
      severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
      attempted TEXT,
      error TEXT,
      recovery TEXT,
      verified INTEGER NOT NULL DEFAULT 0, -- boolean
      action_required TEXT,
      affects_production INTEGER NOT NULL DEFAULT 0, -- boolean
      timestamp INTEGER NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0, -- boolean
      resolution TEXT,
      resolved_at INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_project_dependencies 
      ON project_dependencies(project_id, critical DESC);
    CREATE INDEX IF NOT EXISTS idx_project_env_vars 
      ON project_env_vars(project_id, required DESC);
    CREATE INDEX IF NOT EXISTS idx_project_services 
      ON project_services(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_databases 
      ON project_databases(project_id);
    
    CREATE INDEX IF NOT EXISTS idx_active_work_project 
      ON active_work(project_id, status, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_constraints_project 
      ON constraints(project_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_problems_project 
      ON problems(project_id, status, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_goals_project 
      ON goals(project_id, status, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_project 
      ON notes(project_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_caveats_project 
      ON caveats(project_id, resolved, severity DESC, timestamp DESC);
  `);

  console.log('✅ Database migrated to v2.0');
}

/**
 * Check if v2 tables exist
 */
export function isV2Schema(db: Database.Database): boolean {
  try {
    // Check for all v2 tables (both context layers and enhanced project identity)
    const v2Tables = [
      'active_work',
      'constraints',
      'problems',
      'goals',
      'decisions',
      'notes',
      'caveats',
      'sessions',
      'project_dependencies',
      'project_build_system',
      'project_test_framework',
      'project_env_vars',
      'project_services',
      'project_databases',
      'project_metrics'
    ];

    for (const table of v2Tables) {
      const result = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(table);
      
      if (!result) {
        console.log(`📦 Missing v2 table: ${table}`);
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}
