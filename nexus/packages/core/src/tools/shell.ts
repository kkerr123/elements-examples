import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import type { Tool } from '../llm/client';
import type { ToolContext, ToolHandler } from './index';

const execAsync = promisify(exec);

// Commands that are generally safe to run
const SAFE_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'find', 'grep', 'rg', 'ag',
  'git', 'node', 'npm', 'npx', 'pnpm', 'yarn', 'bun',
  'python', 'python3', 'pip', 'pip3',
  'cargo', 'rustc',
  'go', 'gofmt',
  'make', 'cmake',
  'echo', 'printf', 'date', 'pwd', 'which', 'whoami',
  'diff', 'patch', 'sort', 'uniq', 'cut', 'awk', 'sed',
  'curl', 'wget', 'jq', 'yq',
  'tree', 'file', 'stat', 'du', 'df',
  'tsc', 'eslint', 'prettier', 'jest', 'vitest', 'mocha',
]);

// Commands that should never be allowed
const BLOCKED_COMMANDS = new Set([
  'rm', 'rmdir', 'mv', 'sudo', 'su', 'chmod', 'chown',
  'kill', 'killall', 'pkill',
  'shutdown', 'reboot', 'halt',
  'dd', 'mkfs', 'fdisk', 'parted',
  'passwd', 'useradd', 'userdel', 'groupadd',
]);

/**
 * Check if a command is safe to execute
 */
function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  // Extract the base command
  const parts = command.trim().split(/\s+/);
  const baseCommand = parts[0];

  // Check blocked commands
  if (BLOCKED_COMMANDS.has(baseCommand)) {
    return { safe: false, reason: `Command '${baseCommand}' is not allowed` };
  }

  // Check for shell injection patterns
  if (/[;&|`$()]/.test(command) && !command.startsWith('git')) {
    // Allow some patterns in git commands
    if (!/^\s*git\s/.test(command)) {
      return { safe: false, reason: 'Command contains potentially unsafe characters' };
    }
  }

  // Check for safe commands
  if (SAFE_COMMANDS.has(baseCommand)) {
    return { safe: true };
  }

  // Unknown command - require approval
  return { safe: false, reason: `Unknown command '${baseCommand}' requires approval` };
}

// =============================================================================
// Run Command Tool
// =============================================================================

export const runCommandTool: ToolHandler = {
  tool: {
    name: 'run_command',
    description: 'Execute a shell command. Use this to run build tools, tests, linters, or other development commands. Some dangerous commands are blocked for safety.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Defaults to 60000 (60 seconds).',
        },
      },
      required: ['command'],
    },
  },

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
    const command = input.command as string;
    const timeout = (input.timeout as number) || 60000;

    // Validate command safety
    const safety = isCommandSafe(command);
    if (!safety.safe) {
      throw new Error(safety.reason || 'Command not allowed');
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: context.workingDirectory,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: {
          ...process.env,
          // Don't pass sensitive environment variables
          ANTHROPIC_API_KEY: undefined,
          OPENAI_API_KEY: undefined,
          AWS_SECRET_ACCESS_KEY: undefined,
        },
      });

      let result = '';

      if (stdout) {
        result += stdout;
      }

      if (stderr) {
        if (result) result += '\n\n';
        result += `[stderr]\n${stderr}`;
      }

      return result || '(command completed with no output)';
    } catch (error: any) {
      if (error.killed) {
        throw new Error(`Command timed out after ${timeout}ms`);
      }

      // Include both stdout and stderr in error
      let errorMessage = error.message;
      if (error.stdout) errorMessage += `\n\n[stdout]\n${error.stdout}`;
      if (error.stderr) errorMessage += `\n\n[stderr]\n${error.stderr}`;

      throw new Error(errorMessage);
    }
  },
};
