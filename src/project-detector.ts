// Automatic project detection from filesystem

import * as fs from 'fs';
import * as path from 'path';
import type { Storage } from './storage.js';

export interface ProjectMetadata {
  name: string;
  type: 'node' | 'rust' | 'python' | 'go' | 'unknown';
  techStack: string[];
  architecture?: string;
}

export class ProjectDetector {
  constructor(private storage: Storage) {}

  /**
   * Detect project from a directory path
   */
  detectFromPath(projectPath: string): ProjectMetadata | null {
    // Check if path exists
    if (!fs.existsSync(projectPath)) {
      return null;
    }

    // Check for project markers
    const markers = [
      { file: 'package.json', type: 'node' as const },
      { file: 'Cargo.toml', type: 'rust' as const },
      { file: 'requirements.txt', type: 'python' as const },
      { file: 'pyproject.toml', type: 'python' as const },
      { file: 'go.mod', type: 'go' as const },
      { file: 'composer.json', type: 'unknown' as const },
    ];

    for (const marker of markers) {
      const markerPath = path.join(projectPath, marker.file);
      if (fs.existsSync(markerPath)) {
        return this.extractMetadata(projectPath, marker.file, marker.type);
      }
    }

    return null;
  }

  /**
   * Extract project metadata from marker file
   */
  private extractMetadata(
    projectPath: string,
    markerFile: string,
    type: ProjectMetadata['type']
  ): ProjectMetadata {
    let name = path.basename(projectPath);
    let techStack: string[] = [];
    let architecture: string | undefined;

    try {
      if (markerFile === 'package.json') {
        const pkgPath = path.join(projectPath, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        
        name = pkg.name || name;
        techStack = this.detectNodeTechStack(pkg, projectPath);
        architecture = this.inferArchitecture(techStack);
      } else if (markerFile === 'Cargo.toml') {
        const cargoPath = path.join(projectPath, 'Cargo.toml');
        const cargo = fs.readFileSync(cargoPath, 'utf8');
        const nameMatch = cargo.match(/name\s*=\s*"(.+)"/);
        name = nameMatch ? nameMatch[1] : name;
        techStack = ['Rust'];
      } else if (markerFile === 'go.mod') {
        const goPath = path.join(projectPath, 'go.mod');
        const goMod = fs.readFileSync(goPath, 'utf8');
        const nameMatch = goMod.match(/module\s+(.+)/);
        name = nameMatch ? path.basename(nameMatch[1]) : name;
        techStack = ['Go'];
      } else if (markerFile === 'requirements.txt' || markerFile === 'pyproject.toml') {
        techStack = this.detectPythonTechStack(projectPath);
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
    }

    return {
      name,
      type,
      techStack,
      architecture,
    };
  }

  /**
   * Detect tech stack from package.json
   */
  private detectNodeTechStack(pkg: any, projectPath: string): string[] {
    const stack: string[] = [];
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    // Detect frameworks
    const frameworks = {
      'next': 'Next.js',
      'react': 'React',
      'vue': 'Vue',
      '@angular/core': 'Angular',
      'svelte': 'Svelte',
      'astro': 'Astro',
      'nuxt': 'Nuxt',
      'gatsby': 'Gatsby',
      'express': 'Express',
      'fastify': 'Fastify',
      'nestjs': 'NestJS',
    };

    for (const [dep, name] of Object.entries(frameworks)) {
      if (deps[dep]) {
        // Add version if available
        const version = deps[dep].replace(/[\^\~]/, '');
        if (version && !version.startsWith('http') && !version.includes('*')) {
          stack.push(`${name} ${version}`);
        } else {
          stack.push(name);
        }
      }
    }

    // Detect languages
    if (deps['typescript'] || fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
      stack.push('TypeScript');
    }

    // Detect databases/ORMs
    const databases = {
      '@supabase/supabase-js': 'Supabase',
      'prisma': 'Prisma',
      'mongoose': 'MongoDB',
      'pg': 'PostgreSQL',
      'mysql2': 'MySQL',
      'redis': 'Redis',
      '@planetscale/database': 'PlanetScale',
    };

    for (const [dep, name] of Object.entries(databases)) {
      if (deps[dep]) {
        stack.push(name);
      }
    }

    // Detect styling
    const styling = {
      'tailwindcss': 'Tailwind CSS',
      'sass': 'Sass',
      '@emotion/react': 'Emotion',
      'styled-components': 'Styled Components',
    };

    for (const [dep, name] of Object.entries(styling)) {
      if (deps[dep]) {
        stack.push(name);
      }
    }

    // Detect state management
    const stateManagement = {
      'zustand': 'Zustand',
      'redux': 'Redux',
      '@reduxjs/toolkit': 'Redux Toolkit',
      'jotai': 'Jotai',
      'recoil': 'Recoil',
    };

    for (const [dep, name] of Object.entries(stateManagement)) {
      if (deps[dep]) {
        stack.push(name);
      }
    }

    // Detect auth
    const auth = {
      'next-auth': 'NextAuth',
      '@auth/core': 'Auth.js',
      'passport': 'Passport',
    };

    for (const [dep, name] of Object.entries(auth)) {
      if (deps[dep]) {
        stack.push(name);
      }
    }

    return stack;
  }

  /**
   * Detect Python tech stack
   */
  private detectPythonTechStack(projectPath: string): string[] {
    const stack: string[] = ['Python'];

    // Try to read requirements.txt
    const reqPath = path.join(projectPath, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      const requirements = fs.readFileSync(reqPath, 'utf8');
      
      const frameworks = {
        'django': 'Django',
        'flask': 'Flask',
        'fastapi': 'FastAPI',
        'streamlit': 'Streamlit',
      };

      for (const [pkg, name] of Object.entries(frameworks)) {
        if (requirements.includes(pkg)) {
          stack.push(name);
        }
      }
    }

    return stack;
  }

  /**
   * Infer architecture from tech stack
   */
  private inferArchitecture(techStack: string[]): string | undefined {
    const stack = techStack.join(' ').toLowerCase();

    if (stack.includes('next.js') && stack.includes('typescript')) {
      return 'Next.js with TypeScript';
    }
    
    if (stack.includes('react') && stack.includes('typescript')) {
      return 'React with TypeScript';
    }

    if (stack.includes('next.js')) {
      return 'Next.js';
    }

    if (stack.includes('react')) {
      return 'React';
    }

    return undefined;
  }

  /**
   * Create or update project in storage
   */
  createOrUpdateProject(projectPath: string): void {
    const metadata = this.detectFromPath(projectPath);
    
    if (!metadata) {
      console.error('❌ No project detected at:', projectPath);
      return;
    }

    // Check if project already exists
    const existing = this.storage.findProjectByPath(projectPath);

    if (existing) {
      // Update tech stack if changed
      const newStack = [...new Set([...existing.techStack, ...metadata.techStack])];
      this.storage.updateProject(existing.id, {
        techStack: newStack,
        architecture: metadata.architecture || existing.architecture,
      });
      console.error(`🔄 Updated project: ${existing.name}`);
    } else {
      // Create new project
      const project = this.storage.createProject(metadata.name, projectPath);
      this.storage.updateProject(project.id, {
        techStack: metadata.techStack,
        architecture: metadata.architecture,
      });
      console.error(`📁 Auto-detected project: ${metadata.name}`);
      console.error(`   Tech Stack: ${metadata.techStack.join(', ')}`);
    }
  }
}