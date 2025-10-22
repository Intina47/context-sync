import * as fs from 'fs';
import * as path from 'path';

// Types for type analysis
export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'class' | 'enum';
  filePath: string;
  line: number;
  isExported: boolean;
  raw: string;  // Raw definition text
}

export interface InterfaceInfo extends TypeDefinition {
  kind: 'interface';
  properties: PropertyInfo[];
  methods: MethodInfo[];
  extends?: string[];
}

export interface TypeAliasInfo extends TypeDefinition {
  kind: 'type';
  definition: string;  // The actual type definition
}

export interface ClassInfo extends TypeDefinition {
  kind: 'class';
  properties: PropertyInfo[];
  methods: MethodInfo[];
  constructor?: MethodInfo;
  extends?: string;
  implements?: string[];
}

export interface EnumInfo extends TypeDefinition {
  kind: 'enum';
  members: EnumMember[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  optional: boolean;
  readonly: boolean;
  line: number;
}

export interface MethodInfo {
  name: string;
  params: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isStatic: boolean;
  visibility?: 'public' | 'private' | 'protected';
  line: number;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface EnumMember {
  name: string;
  value?: string | number;
  line: number;
}

export interface TypeUsage {
  filePath: string;
  line: number;
  context: string;  // The line of code where it's used
  usageType: 'variable' | 'parameter' | 'return' | 'generic' | 'implements' | 'extends';
}

export interface TypeInfo {
  definition: TypeDefinition;
  details: InterfaceInfo | TypeAliasInfo | ClassInfo | EnumInfo;
  usages: TypeUsage[];
  relatedTypes: string[];  // Types referenced in this type
}

export class TypeAnalyzer {
  private workspacePath: string;
  private fileCache: Map<string, string>;
  private typeCache: Map<string, TypeDefinition[]>;
  
  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.fileCache = new Map();
    this.typeCache = new Map();
  }

  /**
   * Find type definition by name
   */
  public findTypeDefinition(typeName: string): TypeDefinition | null {
    const allFiles = this.getAllProjectFiles();

    for (const file of allFiles) {
      const types = this.extractTypes(file);
      const found = types.find(t => t.name === typeName);
      if (found) return found;
    }

    return null;
  }

  /**
   * Get complete information about a type
   */
  public getTypeInfo(typeName: string): TypeInfo | null {
    const definition = this.findTypeDefinition(typeName);
    if (!definition) return null;

    const details = this.getTypeDetails(definition);
    const usages = this.findTypeUsages(typeName);
    const relatedTypes = this.extractRelatedTypes(definition);

    return {
      definition,
      details,
      usages,
      relatedTypes
    };
  }

  /**
   * Get detailed information based on type kind
   */
  private getTypeDetails(definition: TypeDefinition): InterfaceInfo | TypeAliasInfo | ClassInfo | EnumInfo {
    const content = this.readFile(definition.filePath);
    const lines = content.split('\n');

    switch (definition.kind) {
      case 'interface':
        return this.parseInterface(definition, lines);
      case 'type':
        return this.parseTypeAlias(definition, lines);
      case 'class':
        return this.parseClass(definition, lines);
      case 'enum':
        return this.parseEnum(definition, lines);
    }
  }

  /**
   * Parse interface details
   */
  private parseInterface(definition: TypeDefinition, lines: string[]): InterfaceInfo {
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];
    let extendsTypes: string[] = [];

    // Find extends
    const headerLine = lines[definition.line - 1];
    const extendsMatch = /extends\s+([\w\s,]+)/.exec(headerLine);
    if (extendsMatch) {
      extendsTypes = extendsMatch[1].split(',').map(t => t.trim());
    }

    // Parse body
    let inInterface = false;
    let braceCount = 0;

    for (let i = definition.line - 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.includes('interface')) {
        inInterface = true;
      }

      if (!inInterface) continue;

      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Property: name: type or name?: type
      const propMatch = /^(readonly\s+)?(\w+)(\?)?:\s*([^;]+);?/.exec(trimmed);
      if (propMatch && !trimmed.includes('(')) {
        properties.push({
          name: propMatch[2],
          type: propMatch[4].trim(),
          optional: !!propMatch[3],
          readonly: !!propMatch[1],
          line: i + 1
        });
        continue;
      }

      // Method: name(): returnType or name(params): returnType
      const methodMatch = /(\w+)\s*\(([^)]*)\)\s*:\s*([^;]+)/.exec(trimmed);
      if (methodMatch) {
        methods.push({
          name: methodMatch[1],
          params: this.parseParameters(methodMatch[2]),
          returnType: methodMatch[3].trim(),
          isAsync: false,
          isStatic: false,
          line: i + 1
        });
      }

      if (braceCount === 0 && inInterface && i > definition.line - 1) {
        break;
      }
    }

    return {
      ...definition,
      kind: 'interface',
      properties,
      methods,
      extends: extendsTypes.length > 0 ? extendsTypes : undefined
    };
  }

  /**
   * Parse type alias details
   */
  private parseTypeAlias(definition: TypeDefinition, lines: string[]): TypeAliasInfo {
    const line = lines[definition.line - 1];
    const match = /type\s+\w+\s*=\s*(.+)/.exec(line);
    const typeDefinition = match ? match[1].trim() : '';

    return {
      ...definition,
      kind: 'type',
      definition: typeDefinition
    };
  }

  /**
   * Parse class details
   */
  private parseClass(definition: TypeDefinition, lines: string[]): ClassInfo {
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];
    let constructorInfo: MethodInfo | undefined;
    let extendsClass: string | undefined;
    let implementsInterfaces: string[] = [];

    // Find extends and implements
    const headerLine = lines[definition.line - 1];
    const extendsMatch = /extends\s+(\w+)/.exec(headerLine);
    if (extendsMatch) {
      extendsClass = extendsMatch[1];
    }

    const implementsMatch = /implements\s+([\w\s,]+)/.exec(headerLine);
    if (implementsMatch) {
      implementsInterfaces = implementsMatch[1].split(',').map(t => t.trim());
    }

    // Parse body
    let inClass = false;
    let braceCount = 0;

    for (let i = definition.line - 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.includes('class')) {
        inClass = true;
      }

      if (!inClass) continue;

      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Property: private/public/protected name: type
      const propMatch = /^(public|private|protected)?\s*(readonly\s+)?(\w+)(\?)?:\s*([^;=]+)/.exec(trimmed);
      if (propMatch && !trimmed.includes('(')) {
        properties.push({
          name: propMatch[3],
          type: propMatch[5].trim(),
          optional: !!propMatch[4],
          readonly: !!propMatch[2],
          line: i + 1
        });
        continue;
      }

      // Constructor
      if (trimmed.includes('constructor')) {
        const constructorMatch = /constructor\s*\(([^)]*)\)/.exec(trimmed);
        if (constructorMatch) {
          constructorInfo = {
            name: 'constructor',
            params: this.parseParameters(constructorMatch[1]),
            isAsync: false,
            isStatic: false,
            line: i + 1
          };
        }
        continue;
      }

      // Method
      const methodMatch = /(public|private|protected)?\s*(static\s+)?(async\s+)?(\w+)\s*\(([^)]*)\)/.exec(trimmed);
      if (methodMatch && !trimmed.includes('if') && !trimmed.includes('while')) {
        const methodName = methodMatch[4];
        if (methodName !== 'constructor') {
          methods.push({
            name: methodName,
            params: this.parseParameters(methodMatch[5]),
            isAsync: !!methodMatch[3],
            isStatic: !!methodMatch[2],
            visibility: methodMatch[1] as any || 'public',
            line: i + 1
          });
        }
      }

      if (braceCount === 0 && inClass && i > definition.line - 1) {
        break;
      }
    }

    return {
      ...definition,
      kind: 'class',
      properties,
      methods,
      constructor: constructorInfo,
      extends: extendsClass,
      implements: implementsInterfaces.length > 0 ? implementsInterfaces : undefined
    };
  }

  /**
   * Parse enum details
   */
  private parseEnum(definition: TypeDefinition, lines: string[]): EnumInfo {
    const members: EnumMember[] = [];
    let inEnum = false;
    let braceCount = 0;

    for (let i = definition.line - 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.includes('enum')) {
        inEnum = true;
      }

      if (!inEnum) continue;

      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Enum member: NAME = value or NAME
      const memberMatch = /(\w+)\s*=?\s*([^,}]+)?/.exec(trimmed);
      if (memberMatch && !trimmed.includes('enum') && trimmed !== '}') {
        const value = memberMatch[2]?.trim().replace(/[,}]/g, '');
        members.push({
          name: memberMatch[1],
          value: value ? (isNaN(Number(value)) ? value : Number(value)) : undefined,
          line: i + 1
        });
      }

      if (braceCount === 0 && inEnum && i > definition.line - 1) {
        break;
      }
    }

    return {
      ...definition,
      kind: 'enum',
      members
    };
  }

  /**
   * Find all usages of a type
   */
  public findTypeUsages(typeName: string): TypeUsage[] {
    const usages: TypeUsage[] = [];
    const allFiles = this.getAllProjectFiles();

    for (const file of allFiles) {
      const content = this.readFile(file);
      const lines = content.split('\n');

      lines.forEach((line, lineNumber) => {
        const trimmed = line.trim();

        // Skip the definition itself
        if (trimmed.includes(`interface ${typeName}`) || 
            trimmed.includes(`type ${typeName}`) ||
            trimmed.includes(`class ${typeName}`) ||
            trimmed.includes(`enum ${typeName}`)) {
          return;
        }

        // Check for usage
        if (trimmed.includes(typeName)) {
          let usageType: TypeUsage['usageType'] = 'variable';

          if (trimmed.includes('implements') && trimmed.includes(typeName)) {
            usageType = 'implements';
          } else if (trimmed.includes('extends') && trimmed.includes(typeName)) {
            usageType = 'extends';
          } else if (trimmed.includes('<') && trimmed.includes(typeName)) {
            usageType = 'generic';
          } else if (trimmed.match(new RegExp(`\\w+\\s*:\\s*${typeName}`))) {
            usageType = 'variable';
          } else if (trimmed.match(new RegExp(`\\)\\s*:\\s*${typeName}`))) {
            usageType = 'return';
          }

          usages.push({
            filePath: file,
            line: lineNumber + 1,
            context: trimmed,
            usageType
          });
        }
      });
    }

    return usages;
  }

  /**
   * Extract all type definitions from a file
   */
  private extractTypes(filePath: string): TypeDefinition[] {
    if (this.typeCache.has(filePath)) {
      return this.typeCache.get(filePath)!;
    }

    const content = this.readFile(filePath);
    const types: TypeDefinition[] = [];
    const lines = content.split('\n');

    lines.forEach((line, lineNumber) => {
      const trimmed = line.trim();

      // Interface
      const interfaceMatch = /(?:export\s+)?interface\s+(\w+)/.exec(trimmed);
      if (interfaceMatch) {
        types.push({
          name: interfaceMatch[1],
          kind: 'interface',
          filePath,
          line: lineNumber + 1,
          isExported: trimmed.includes('export'),
          raw: line
        });
        return;
      }

      // Type alias
      const typeMatch = /(?:export\s+)?type\s+(\w+)\s*=/.exec(trimmed);
      if (typeMatch) {
        types.push({
          name: typeMatch[1],
          kind: 'type',
          filePath,
          line: lineNumber + 1,
          isExported: trimmed.includes('export'),
          raw: line
        });
        return;
      }

      // Class
      const classMatch = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/.exec(trimmed);
      if (classMatch) {
        types.push({
          name: classMatch[1],
          kind: 'class',
          filePath,
          line: lineNumber + 1,
          isExported: trimmed.includes('export'),
          raw: line
        });
        return;
      }

      // Enum
      const enumMatch = /(?:export\s+)?enum\s+(\w+)/.exec(trimmed);
      if (enumMatch) {
        types.push({
          name: enumMatch[1],
          kind: 'enum',
          filePath,
          line: lineNumber + 1,
          isExported: trimmed.includes('export'),
          raw: line
        });
      }
    });

    this.typeCache.set(filePath, types);
    return types;
  }

  /**
   * Extract related types referenced in this type
   */
  private extractRelatedTypes(definition: TypeDefinition): string[] {
    const content = this.readFile(definition.filePath);
    const lines = content.split('\n');
    const relatedTypes = new Set<string>();

    // Get the type definition block
    let inType = false;
    let braceCount = 0;

    for (let i = definition.line - 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (i === definition.line - 1) {
        inType = true;
      }

      if (!inType) continue;

      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Extract type references (capitalized words that might be types)
      const typeReferences = line.match(/:\s*([A-Z]\w+)/g);
      if (typeReferences) {
        typeReferences.forEach(ref => {
          const typeName = ref.replace(/:\s*/, '');
          if (typeName !== definition.name) {
            relatedTypes.add(typeName);
          }
        });
      }

      if (braceCount === 0 && inType && i > definition.line - 1) {
        break;
      }
    }

    return Array.from(relatedTypes);
  }

  /**
   * Parse function/method parameters
   */
  private parseParameters(paramString: string): ParameterInfo[] {
    if (!paramString || !paramString.trim()) return [];

    return paramString.split(',').map(param => {
      const trimmed = param.trim();
      const optional = trimmed.includes('?');
      const hasDefault = trimmed.includes('=');

      // Extract name, type, and default value
      const match = /(\w+)(\?)?:\s*([^=]+)(?:=\s*(.+))?/.exec(trimmed);
      
      if (match) {
        return {
          name: match[1],
          type: match[3]?.trim(),
          optional: optional || hasDefault,
          defaultValue: match[4]?.trim()
        };
      }

      // Simple parameter without type
      const simpleMatch = /(\w+)(\?)?/.exec(trimmed);
      return {
        name: simpleMatch?.[1] || trimmed,
        optional: optional,
      };
    });
  }

  // Helper methods

  private readFile(filePath: string): string {
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.fileCache.set(filePath, content);
      return content;
    } catch (error) {
      return '';
    }
  }

  private getRelativePath(filePath: string): string {
    return path.relative(this.workspacePath, filePath);
  }

  private getAllProjectFiles(): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx'];  // Only TypeScript files for type analysis
    
    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!['node_modules', 'dist', 'build', '.git', '.next', 'out', 'coverage'].includes(entry.name)) {
              walk(fullPath);
            }
          } else {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walk(this.workspacePath);
    return files;
  }

  /**
   * Clear caches
   */
  public clearCache() {
    this.fileCache.clear();
    this.typeCache.clear();
  }
}