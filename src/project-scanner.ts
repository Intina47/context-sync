/**
 * Project Scanner - Layer 1: File System Access
 * Reads ALL config files ONCE, caches in memory
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';

export interface ProjectFiles {
  // Manifests
  packageJson?: any;
  packageLock?: any;
  yarnLock?: string;
  goMod?: string;
  goSum?: string;
  cargoToml?: any;
  cargoLock?: any;
  
  // Configs
  jestConfig?: any;
  vitestConfig?: any;
  pytestConfig?: string;
  
  // Env files
  envFiles: Map<string, string>; // filename -> content
  
  // Git info
  git: {
    head?: string;
    lastCommit?: Date;
    contributors?: number;
    stats?: any;
  };
  
  // Source code samples (for service detection)
  mainFiles: Map<string, string>; // path -> content
}

export class ProjectScanner {
  private git: SimpleGit;
  
  constructor(private projectPath: string) {
    this.git = simpleGit(projectPath, { 
      timeout: { block: 5000 },
      config: []
    });
  }

  /**
   * Single file system scan - reads everything we need ONCE
   */
  async scan(): Promise<ProjectFiles> {
    const files: ProjectFiles = {
      envFiles: new Map(),
      mainFiles: new Map(),
      git: {}
    };

    // Parallel reads for all potential config files
    await Promise.all([
      this.readManifests(files),
      this.readConfigs(files),
      this.readEnvFiles(files),
      this.readGitInfo(files),
      this.readMainFiles(files)
    ]);

    return files;
  }

  private async readManifests(files: ProjectFiles): Promise<void> {
    const reads = [
      this.readJson('package.json').then(pkg => files.packageJson = pkg),
      this.readJson('package-lock.json').then(lock => files.packageLock = lock),
      this.readText('yarn.lock').then(yarn => files.yarnLock = yarn),
      this.readText('go.mod').then(mod => files.goMod = mod),
      this.readText('go.sum').then(sum => files.goSum = sum),
      this.readToml('Cargo.toml').then(toml => files.cargoToml = toml),
      this.readToml('Cargo.lock').then(lock => files.cargoLock = lock),
    ];

    await Promise.allSettled(reads);
  }

  private async readConfigs(files: ProjectFiles): Promise<void> {
    const reads = [
      this.readJson('jest.config.json').then(cfg => files.jestConfig = cfg),
      this.readText('pytest.ini').then(cfg => files.pytestConfig = cfg),
    ];

    // Also try .js/.ts config files
    const jestJs = await this.fileExists('jest.config.js');
    const vitestTs = await this.fileExists('vitest.config.ts');
    
    if (jestJs) files.jestConfig = { exists: true, file: 'jest.config.js' };
    if (vitestTs) files.vitestConfig = { exists: true, file: 'vitest.config.ts' };

    await Promise.allSettled(reads);
  }

  private async readEnvFiles(files: ProjectFiles): Promise<void> {
    const envFileNames = ['.env', '.env.example', '.env.local', '.env.development', '.env.production'];
    
    const reads = envFileNames.map(async name => {
      const content = await this.readText(name);
      if (content) files.envFiles.set(name, content);
    });

    await Promise.allSettled(reads);
  }

  private async readGitInfo(files: ProjectFiles): Promise<void> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) return;

      const [log, contributors] = await Promise.all([
        this.git.log({ maxCount: 1 }).catch(() => null),
        this.git.raw(['shortlog', '-sn', '--all']).catch(() => '')
      ]);

      if (log?.latest) {
        files.git.head = log.latest.hash;
        files.git.lastCommit = new Date(log.latest.date);
      }

      if (contributors) {
        const lines = contributors.trim().split('\n').filter((line: string) => line.trim());
        files.git.contributors = lines.length;
      }
    } catch {
      // Not a git repo or git not available
    }
  }

  private async readMainFiles(files: ProjectFiles): Promise<void> {
    // Read likely entry points for service detection
    const candidates = [
      'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
      'src/server.ts', 'src/server.js', 'src/app.ts', 'src/app.js',
      'index.ts', 'index.js', 'server.ts', 'server.js',
      'main.go', 'main.rs'
    ];

    const reads = candidates.map(async file => {
      const content = await this.readText(file);
      if (content) files.mainFiles.set(file, content);
    });

    await Promise.allSettled(reads);
  }

  // Helper methods
  private async readJson(filename: string): Promise<any | undefined> {
    try {
      const content = await fs.readFile(path.join(this.projectPath, filename), 'utf8');
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }

  private async readText(filename: string): Promise<string | undefined> {
    try {
      return await fs.readFile(path.join(this.projectPath, filename), 'utf8');
    } catch {
      return undefined;
    }
  }

  private async readToml(filename: string): Promise<any | undefined> {
    try {
      const content = await this.readText(filename);
      if (!content) return undefined;
      
      const toml = await import('@iarna/toml');
      return toml.parse(content);
    } catch {
      return undefined;
    }
  }

  private async fileExists(filename: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectPath, filename));
      return true;
    } catch {
      return false;
    }
  }
}

