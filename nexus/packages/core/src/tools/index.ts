import type { Tool } from '../llm/client';
import { readFileTool, writeFileTool, listDirectoryTool, searchFilesTool } from './filesystem';
import { runCommandTool } from './shell';
import { gitStatusTool, gitDiffTool } from './git-tools';

export interface ToolContext {
  workingDirectory: string;
  allowedPaths?: string[];      // Glob patterns for allowed paths
  blockedPaths?: string[];      // Glob patterns for blocked paths
  requireApproval?: boolean;    // Whether to require user approval for write operations
}

export interface ToolHandler {
  tool: Tool;
  execute: (input: Record<string, unknown>, context: ToolContext) => Promise<string>;
}

// Export all tools
export { readFileTool, writeFileTool, listDirectoryTool, searchFilesTool } from './filesystem';
export { runCommandTool } from './shell';
export { gitStatusTool, gitDiffTool } from './git-tools';

/**
 * Get all available tools
 */
export function getAllTools(): Tool[] {
  return [
    readFileTool.tool,
    writeFileTool.tool,
    listDirectoryTool.tool,
    searchFilesTool.tool,
    runCommandTool.tool,
    gitStatusTool.tool,
    gitDiffTool.tool,
  ];
}

/**
 * Get tool handler by name
 */
export function getToolHandler(name: string): ToolHandler | undefined {
  const handlers: Record<string, ToolHandler> = {
    read_file: readFileTool,
    write_file: writeFileTool,
    list_directory: listDirectoryTool,
    search_files: searchFilesTool,
    run_command: runCommandTool,
    git_status: gitStatusTool,
    git_diff: gitDiffTool,
  };

  return handlers[name];
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<string> {
  const handler = getToolHandler(name);
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return handler.execute(input, context);
}
