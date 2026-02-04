import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool } from '../llm/client';
import type { ToolContext, ToolHandler } from './index';

const execAsync = promisify(exec);

/**
 * Validate that a path is within the allowed working directory
 */
function validatePath(filePath: string, context: ToolContext): string {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(context.workingDirectory, filePath);

  // Ensure path is within working directory
  const normalizedPath = path.normalize(absolutePath);
  const normalizedWorkDir = path.normalize(context.workingDirectory);

  if (!normalizedPath.startsWith(normalizedWorkDir)) {
    throw new Error(`Path is outside working directory: ${filePath}`);
  }

  return normalizedPath;
}

// =============================================================================
// Read File Tool
// =============================================================================

export const readFileTool: ToolHandler = {
  tool: {
    name: 'read_file',
    description: 'Read the contents of a file. Use this to examine existing code, configuration files, or any text file in the project.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file to read, relative to the project root',
        },
        start_line: {
          type: 'number',
          description: 'Optional starting line number (1-indexed)',
        },
        end_line: {
          type: 'number',
          description: 'Optional ending line number (1-indexed)',
        },
      },
      required: ['path'],
    },
  },

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
    const filePath = validatePath(input.path as string, context);
    const startLine = input.start_line as number | undefined;
    const endLine = input.end_line as number | undefined;

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (startLine || endLine) {
        const lines = content.split('\n');
        const start = (startLine || 1) - 1;
        const end = endLine || lines.length;
        return lines.slice(start, end).join('\n');
      }

      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${input.path}`);
      }
      throw error;
    }
  },
};

// =============================================================================
// Write File Tool
// =============================================================================

export const writeFileTool: ToolHandler = {
  tool: {
    name: 'write_file',
    description: 'Write content to a file. This will create the file if it does not exist, or overwrite it if it does. Use this to create or modify code files.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file to write, relative to the project root',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
    const filePath = validatePath(input.path as string, context);
    const content = input.content as string;

    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Check if file exists for reporting
    let existed = false;
    try {
      await fs.access(filePath);
      existed = true;
    } catch {
      // File doesn't exist
    }

    // Write the file
    await fs.writeFile(filePath, content, 'utf-8');

    const lines = content.split('\n').length;
    const relativePath = path.relative(context.workingDirectory, filePath);

    return existed
      ? `Updated ${relativePath} (${lines} lines)`
      : `Created ${relativePath} (${lines} lines)`;
  },
};

// =============================================================================
// List Directory Tool
// =============================================================================

export const listDirectoryTool: ToolHandler = {
  tool: {
    name: 'list_directory',
    description: 'List files and directories in a given path. Use this to explore the project structure.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to list, relative to the project root. Defaults to root if not provided.',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list recursively. Defaults to false.',
        },
        max_depth: {
          type: 'number',
          description: 'Maximum depth for recursive listing. Defaults to 3.',
        },
      },
      required: [],
    },
  },

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
    const dirPath = validatePath((input.path as string) || '.', context);
    const recursive = input.recursive as boolean || false;
    const maxDepth = input.max_depth as number || 3;

    const entries: string[] = [];

    async function listDir(currentPath: string, depth: number, prefix: string = ''): Promise<void> {
      if (depth > maxDepth) return;

      const items = await fs.readdir(currentPath, { withFileTypes: true });

      // Sort: directories first, then files
      items.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const item of items) {
        // Skip hidden files and common ignore patterns
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;

        const isDir = item.isDirectory();
        const marker = isDir ? '/' : '';
        entries.push(`${prefix}${item.name}${marker}`);

        if (recursive && isDir) {
          await listDir(
            path.join(currentPath, item.name),
            depth + 1,
            prefix + '  '
          );
        }
      }
    }

    await listDir(dirPath, 0);

    if (entries.length === 0) {
      return 'Directory is empty';
    }

    return entries.join('\n');
  },
};

// =============================================================================
// Search Files Tool
// =============================================================================

export const searchFilesTool: ToolHandler = {
  tool: {
    name: 'search_files',
    description: 'Search for text patterns in files using ripgrep. Use this to find code, function definitions, or any text patterns.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The search pattern (supports regex)',
        },
        path: {
          type: 'string',
          description: 'Directory to search in, relative to project root. Defaults to root.',
        },
        file_pattern: {
          type: 'string',
          description: 'Glob pattern to filter files (e.g., "*.ts", "*.{js,jsx}")',
        },
        case_sensitive: {
          type: 'boolean',
          description: 'Whether the search is case sensitive. Defaults to false.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return. Defaults to 50.',
        },
      },
      required: ['pattern'],
    },
  },

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
    const searchPath = validatePath((input.path as string) || '.', context);
    const pattern = input.pattern as string;
    const filePattern = input.file_pattern as string | undefined;
    const caseSensitive = input.case_sensitive as boolean || false;
    const maxResults = input.max_results as number || 50;

    // Build ripgrep command
    const args = ['rg', '--json', '-n'];

    if (!caseSensitive) args.push('-i');
    if (filePattern) args.push('-g', filePattern);
    args.push('-m', String(maxResults));
    args.push('--', pattern, searchPath);

    try {
      const { stdout } = await execAsync(args.join(' '), {
        cwd: context.workingDirectory,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      // Parse ripgrep JSON output
      const results: string[] = [];
      const lines = stdout.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.type === 'match') {
            const filePath = path.relative(context.workingDirectory, data.data.path.text);
            const lineNum = data.data.line_number;
            const text = data.data.lines.text.trim();
            results.push(`${filePath}:${lineNum}: ${text}`);
          }
        } catch {
          // Skip malformed lines
        }
      }

      if (results.length === 0) {
        return `No matches found for pattern: ${pattern}`;
      }

      return results.join('\n');
    } catch (error) {
      // ripgrep returns exit code 1 when no matches found
      if ((error as any).code === 1) {
        return `No matches found for pattern: ${pattern}`;
      }

      // Fall back to grep if ripgrep not available
      try {
        const grepArgs = ['grep', '-rn'];
        if (!caseSensitive) grepArgs.push('-i');
        grepArgs.push(pattern, searchPath);

        const { stdout } = await execAsync(grepArgs.join(' '), {
          cwd: context.workingDirectory,
          maxBuffer: 10 * 1024 * 1024,
        });

        return stdout.trim() || `No matches found for pattern: ${pattern}`;
      } catch {
        return `No matches found for pattern: ${pattern}`;
      }
    }
  },
};
