import { simpleGit } from 'simple-git';
import type { Tool } from '../llm/client';
import type { ToolContext, ToolHandler } from './index';

// =============================================================================
// Git Status Tool
// =============================================================================

export const gitStatusTool: ToolHandler = {
  tool: {
    name: 'git_status',
    description: 'Get the current git status including staged, unstaged, and untracked files. Use this to understand what changes have been made.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  async execute(_input: Record<string, unknown>, context: ToolContext): Promise<string> {
    const git = simpleGit(context.workingDirectory);
    const status = await git.status();

    const lines: string[] = [];

    lines.push(`Branch: ${status.current}`);

    if (status.ahead > 0) {
      lines.push(`Ahead of origin by ${status.ahead} commit(s)`);
    }
    if (status.behind > 0) {
      lines.push(`Behind origin by ${status.behind} commit(s)`);
    }

    if (status.staged.length > 0) {
      lines.push('\nStaged changes:');
      for (const file of status.staged) {
        lines.push(`  + ${file}`);
      }
    }

    if (status.modified.length > 0) {
      lines.push('\nModified files:');
      for (const file of status.modified) {
        lines.push(`  M ${file}`);
      }
    }

    if (status.created.length > 0) {
      lines.push('\nNew files:');
      for (const file of status.created) {
        lines.push(`  ? ${file}`);
      }
    }

    if (status.deleted.length > 0) {
      lines.push('\nDeleted files:');
      for (const file of status.deleted) {
        lines.push(`  D ${file}`);
      }
    }

    if (status.renamed.length > 0) {
      lines.push('\nRenamed files:');
      for (const file of status.renamed) {
        lines.push(`  R ${file.from} -> ${file.to}`);
      }
    }

    if (status.not_added.length > 0) {
      lines.push('\nUntracked files:');
      for (const file of status.not_added) {
        lines.push(`  ? ${file}`);
      }
    }

    if (status.isClean()) {
      lines.push('\nWorking tree is clean');
    }

    return lines.join('\n');
  },
};

// =============================================================================
// Git Diff Tool
// =============================================================================

export const gitDiffTool: ToolHandler = {
  tool: {
    name: 'git_diff',
    description: 'Show the diff of changes for a specific file or all files. Use this to see exactly what has changed.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Optional file path to get diff for. If not provided, shows diff for all changed files.',
        },
        staged: {
          type: 'boolean',
          description: 'If true, show staged changes (--staged). Defaults to false.',
        },
      },
      required: [],
    },
  },

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
    const git = simpleGit(context.workingDirectory);
    const filePath = input.path as string | undefined;
    const staged = input.staged as boolean || false;

    const args: string[] = [];
    if (staged) args.push('--staged');
    if (filePath) args.push('--', filePath);

    const diff = await git.diff(args);

    if (!diff) {
      return staged ? 'No staged changes' : 'No changes';
    }

    return diff;
  },
};
