/**
 * Project Analyzers - Layer 2: Interpretation
 * Work on cached ProjectFiles data, no file system access
 */

import { ProjectFiles } from './project-scanner.js';

export interface DependencyInfo {
  name: string;
  version: string;
  critical: boolean;
  dev: boolean;
}

export interface BuildSystem {
  type: 'npm' | 'gradle' | 'maven' | 'make' | 'cargo' | 'go' | 'poetry' | 'unknown';
  commands: Record<string, string>;
  configFile: string;
}

export interface TestFramework {
  name: string;
  pattern: string;
  configFile?: string;
  coverage: number | null;
}

export interface EnvVarInfo {
  required: string[];
  optional: string[];
  example: Record<string, string>;
  envFiles: string[];
}

export interface ServiceInfo {
  name: string;
  port: number | null;
  protocol: 'http' | 'https' | 'grpc' | 'websocket' | 'unknown';
  healthCheck?: string;
}

export interface DatabaseInfo {
  type: 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'unknown';
  connectionVar?: string;
  migrations: boolean;
  migrationsPath?: string;
}

export class DependencyAnalyzer {
  static analyze(files: ProjectFiles): DependencyInfo[] {
    const deps: DependencyInfo[] = [];

    // Node.js: Use lockfile first (exact versions), fall back to package.json
    if (files.packageLock) {
      // package-lock.json v2/v3 format
      const packages = files.packageLock.packages || files.packageLock.dependencies;
      if (packages) {
        for (const [name, info] of Object.entries(packages)) {
          if (!name || name === '') continue; // Root package
          
          const pkgInfo = info as any;
          const pkgName = name.replace(/^node_modules\//, '');
          deps.push({
            name: pkgName,
            version: pkgInfo.version || 'unknown',
            critical: !pkgInfo.dev,
            dev: !!pkgInfo.dev
          });
        }
      }
    } else if (files.packageJson) {
      // Fall back to package.json (but versions will be ranges)
      const pkg = files.packageJson;
      
      if (pkg.dependencies) {
        for (const [name, version] of Object.entries(pkg.dependencies)) {
          deps.push({
            name,
            version: this.cleanVersion(version as string),
            critical: true,
            dev: false
          });
        }
      }
      
      if (pkg.devDependencies) {
        for (const [name, version] of Object.entries(pkg.devDependencies)) {
          deps.push({
            name,
            version: this.cleanVersion(version as string),
            critical: false,
            dev: true
          });
        }
      }
    }

    // Go: Parse go.mod (direct) and go.sum (exact versions)
    if (files.goMod) {
      const goDeps = this.parseGoMod(files.goMod, files.goSum);
      deps.push(...goDeps);
    }

    // Rust: Parse Cargo.lock (exact) or Cargo.toml
    if (files.cargoLock) {
      const rustDeps = this.parseCargoLock(files.cargoLock);
      deps.push(...rustDeps);
    } else if (files.cargoToml) {
      const rustDeps = this.parseCargoToml(files.cargoToml);
      deps.push(...rustDeps);
    }

    return deps;
  }

  private static parseGoMod(goMod: string, goSum?: string): DependencyInfo[] {
    const deps: DependencyInfo[] = [];
    const lines = goMod.split('\n');
    let inRequire = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Inline require
      if (trimmed.startsWith('require ')) {
        const match = trimmed.match(/require\s+(\S+)\s+v?(\S+)/);
        if (match) {
          deps.push({
            name: match[1],
            version: match[2],
            critical: true,
            dev: false
          });
        }
        continue;
      }

      // Require block
      if (trimmed === 'require (') {
        inRequire = true;
        continue;
      }

      if (trimmed === ')' && inRequire) {
        inRequire = false;
        continue;
      }

      if (inRequire && trimmed && !trimmed.startsWith('//')) {
        const match = trimmed.match(/(\S+)\s+v?(\S+)/);
        if (match) {
          const isDev = trimmed.includes('// indirect');
          deps.push({
            name: match[1],
            version: match[2],
            critical: !isDev,
            dev: isDev
          });
        }
      }
    }

    return deps;
  }

  private static parseCargoLock(cargoLock: any): DependencyInfo[] {
    const deps: DependencyInfo[] = [];
    
    if (cargoLock.package) {
      for (const pkg of cargoLock.package) {
        deps.push({
          name: pkg.name,
          version: pkg.version,
          critical: true,
          dev: false
        });
      }
    }

    return deps;
  }

  private static parseCargoToml(cargoToml: any): DependencyInfo[] {
    const deps: DependencyInfo[] = [];

    if (cargoToml.dependencies) {
      for (const [name, info] of Object.entries(cargoToml.dependencies)) {
        const version = typeof info === 'string' ? info : (info as any).version || 'unknown';
        deps.push({
          name,
          version,
          critical: true,
          dev: false
        });
      }
    }

    if (cargoToml['dev-dependencies']) {
      for (const [name, info] of Object.entries(cargoToml['dev-dependencies'])) {
        const version = typeof info === 'string' ? info : (info as any).version || 'unknown';
        deps.push({
          name,
          version,
          critical: false,
          dev: true
        });
      }
    }

    return deps;
  }

  private static cleanVersion(version: string): string {
    return version.replace(/[\^\~]/, '');
  }
}

export class BuildSystemAnalyzer {
  static analyze(files: ProjectFiles): BuildSystem {
    // Node.js
    if (files.packageJson) {
      return {
        type: 'npm',
        commands: files.packageJson.scripts || {},
        configFile: 'package.json'
      };
    }

    // Gradle
    if (files.cargoToml) {
      return {
        type: 'cargo',
        commands: {
          build: 'cargo build',
          test: 'cargo test',
          start: 'cargo run'
        },
        configFile: 'Cargo.toml'
      };
    }

    // Go
    if (files.goMod) {
      return {
        type: 'go',
        commands: {
          build: 'go build',
          test: 'go test ./...',
          start: 'go run .'
        },
        configFile: 'go.mod'
      };
    }

    return {
      type: 'unknown',
      commands: {},
      configFile: 'none'
    };
  }
}

export class TestFrameworkAnalyzer {
  static analyze(files: ProjectFiles): TestFramework | null {
    // Jest
    if (files.jestConfig) {
      return {
        name: 'Jest',
        pattern: '**/*.test.{js,ts,jsx,tsx}',
        configFile: files.jestConfig.file || 'jest.config.json',
        coverage: null
      };
    }

    // Vitest
    if (files.vitestConfig) {
      return {
        name: 'Vitest',
        pattern: '**/*.test.{js,ts}',
        configFile: 'vitest.config.ts',
        coverage: null
      };
    }

    // pytest
    if (files.pytestConfig) {
      return {
        name: 'pytest',
        pattern: '**/test_*.py',
        configFile: 'pytest.ini',
        coverage: null
      };
    }

    // Check package.json scripts
    if (files.packageJson?.scripts?.test) {
      const script = files.packageJson.scripts.test;
      if (script.includes('jest')) {
        return { name: 'Jest', pattern: '**/*.test.{js,ts}', coverage: null };
      }
      if (script.includes('vitest')) {
        return { name: 'Vitest', pattern: '**/*.test.{js,ts}', coverage: null };
      }
    }

    // Check for Go testing (built-in)
    if (files.goMod) {
      return {
        name: 'Go testing',
        pattern: '**/*_test.go',
        configFile: 'go.mod',
        coverage: null
      };
    }

    // Check for Rust testing (built-in)
    if (files.cargoToml) {
      return {
        name: 'Rust testing',
        pattern: 'tests/**/*.rs',
        configFile: 'Cargo.toml',
        coverage: null
      };
    }

    return null;
  }
}

export class EnvVarAnalyzer {
  static analyze(files: ProjectFiles): EnvVarInfo {
    const required = new Set<string>();
    const optional = new Set<string>();
    const example: Record<string, string> = {};
    const envFiles: string[] = [];

    for (const [filename, content] of files.envFiles) {
      envFiles.push(filename);
      const vars = this.parseEnvFile(content);
      
      for (const [key, value] of vars) {
        example[key] = value;
        
        // .env.example vars are required if it's the only env file
        if (filename.includes('example') && files.envFiles.size === 1) {
          required.add(key);
        } else if (filename === '.env') {
          required.add(key);
        } else {
          optional.add(key);
        }
      }
    }

    // Remove from optional if in required
    optional.forEach(key => {
      if (required.has(key)) optional.delete(key);
    });

    return {
      required: Array.from(required),
      optional: Array.from(optional),
      example,
      envFiles
    };
  }

  private static parseEnvFile(content: string): Map<string, string> {
    const vars = new Map<string, string>();
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        vars.set(match[1], match[2].replace(/^["']|["']$/g, ''));
      }
    }

    return vars;
  }
}

export class ServiceAnalyzer {
  static analyze(files: ProjectFiles): ServiceInfo[] {
    const services: ServiceInfo[] = [];

    // Check package.json scripts for ports
    if (files.packageJson?.scripts) {
      for (const [name, script] of Object.entries(files.packageJson.scripts)) {
        const portMatch = (script as string).match(/:(\d+)/);
        if (portMatch) {
          services.push({
            name: name.includes('dev') ? 'Development Server' : 'Server',
            port: parseInt(portMatch[1]),
            protocol: 'http',
          });
        }
      }
    }

    // Scan main files for .listen() calls
    for (const [file, content] of files.mainFiles) {
      const listenMatch = content.match(/\.listen\s*\(\s*(\d+)/);
      if (listenMatch) {
        const framework = this.detectFramework(content);
        services.push({
          name: framework || 'Server',
          port: parseInt(listenMatch[1]),
          protocol: 'http'
        });
      }
    }

    // Deduplicate by port
    const seen = new Set<number>();
    return services.filter(s => {
      if (s.port && seen.has(s.port)) return false;
      if (s.port) seen.add(s.port);
      return true;
    });
  }

  private static detectFramework(content: string): string | null {
    if (content.includes('express')) return 'Express';
    if (content.includes('fastify')) return 'Fastify';
    if (content.includes('next')) return 'Next.js';
    return null;
  }
}

export class DatabaseAnalyzer {
  static analyze(files: ProjectFiles): DatabaseInfo[] {
    const databases: DatabaseInfo[] = [];
    const deps = DependencyAnalyzer.analyze(files);

    // Check dependencies for database drivers
    const dbMap: Record<string, DatabaseInfo['type']> = {
      'pg': 'postgres',
      'postgres': 'postgres',
      'mysql': 'mysql',
      'mysql2': 'mysql',
      'mongodb': 'mongodb',
      'mongoose': 'mongodb',
      'sqlite3': 'sqlite',
      'better-sqlite3': 'sqlite',
      'redis': 'redis'
    };

    for (const dep of deps) {
      const dbType = dbMap[dep.name.toLowerCase()];
      if (dbType) {
        databases.push({
          type: dbType,
          migrations: false, // TODO: detect migration systems
          migrationsPath: undefined
        });
      }
    }

    return databases;
  }
}

