import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Repository, WorktreeInfo } from './repository';

export interface WorktreeConfig {
  basePath: string;      // Base repo path
  worktreesDir: string;  // Directory to store worktrees (default: .nexus/worktrees)
}

export interface CreateWorktreeOptions {
  name: string;          // Unique name for this worktree (usually agent ID)
  baseBranch?: string;   // Branch to create worktree from (default: current branch)
  newBranch?: string;    // Create a new branch for this worktree
}

/**
 * Manages git worktrees for agent isolation
 */
export class WorktreeManager {
  private git: SimpleGit;
  private config: WorktreeConfig;

  constructor(repoPath: string, worktreesDir?: string) {
    this.git = simpleGit(repoPath);
    this.config = {
      basePath: repoPath,
      worktreesDir: worktreesDir || path.join(repoPath, '.nexus', 'worktrees'),
    };
  }

  /**
   * Ensure worktrees directory exists
   */
  private async ensureWorktreesDir(): Promise<void> {
    await fs.mkdir(this.config.worktreesDir, { recursive: true });

    // Add to .gitignore if not already there
    const gitignorePath = path.join(this.config.basePath, '.gitignore');
    try {
      const gitignore = await fs.readFile(gitignorePath, 'utf-8');
      if (!gitignore.includes('.nexus/')) {
        await fs.appendFile(gitignorePath, '\n# Nexus agent worktrees\n.nexus/\n');
      }
    } catch {
      // .gitignore doesn't exist, create it
      await fs.writeFile(gitignorePath, '# Nexus agent worktrees\n.nexus/\n');
    }
  }

  /**
   * Create a new worktree for an agent
   */
  async create(options: CreateWorktreeOptions): Promise<WorktreeInfo> {
    await this.ensureWorktreesDir();

    const worktreePath = path.join(this.config.worktreesDir, options.name);

    // Check if worktree already exists
    const exists = await this.exists(options.name);
    if (exists) {
      throw new Error(`Worktree already exists: ${options.name}`);
    }

    // Determine the branch to use
    const branchName = options.newBranch || `nexus/${options.name}`;
    const baseBranch = options.baseBranch || 'HEAD';

    // Create the worktree with a new branch
    await this.git.raw([
      'worktree',
      'add',
      '-b',
      branchName,
      worktreePath,
      baseBranch,
    ]);

    // Get the commit hash
    const worktreeGit = simpleGit(worktreePath);
    const log = await worktreeGit.log({ maxCount: 1 });
    const commit = log.latest?.hash || '';

    return {
      path: worktreePath,
      branch: branchName,
      commit,
      isMain: false,
    };
  }

  /**
   * Check if a worktree exists
   */
  async exists(name: string): Promise<boolean> {
    const worktreePath = path.join(this.config.worktreesDir, name);
    try {
      await fs.access(worktreePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get info about a worktree
   */
  async get(name: string): Promise<WorktreeInfo | null> {
    const worktrees = await this.list();
    return worktrees.find((wt) => wt.path.endsWith(name)) || null;
  }

  /**
   * List all worktrees
   */
  async list(): Promise<WorktreeInfo[]> {
    const output = await this.git.raw(['worktree', 'list', '--porcelain']);
    const worktrees: WorktreeInfo[] = [];

    const lines = output.trim().split('\n');
    let current: Partial<WorktreeInfo> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        current.path = line.substring(9);
      } else if (line.startsWith('HEAD ')) {
        current.commit = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7).replace('refs/heads/', '');
      } else if (line === '') {
        if (current.path) {
          worktrees.push({
            path: current.path,
            branch: current.branch || 'detached',
            commit: current.commit || '',
            isMain: current.path === this.config.basePath,
          });
        }
        current = {};
      }
    }

    // Don't forget the last entry
    if (current.path) {
      worktrees.push({
        path: current.path,
        branch: current.branch || 'detached',
        commit: current.commit || '',
        isMain: current.path === this.config.basePath,
      });
    }

    return worktrees;
  }

  /**
   * Remove a worktree
   */
  async remove(name: string, force: boolean = false): Promise<void> {
    const worktreePath = path.join(this.config.worktreesDir, name);

    // Get the branch name before removing
    const worktrees = await this.list();
    const worktree = worktrees.find((wt) => wt.path === worktreePath);
    const branchName = worktree?.branch;

    // Remove the worktree
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(worktreePath);

    try {
      await this.git.raw(args);
    } catch (error) {
      // If worktree doesn't exist in git, try to clean up manually
      await fs.rm(worktreePath, { recursive: true, force: true });
    }

    // Optionally delete the branch (if it was created by nexus)
    if (branchName && branchName.startsWith('nexus/')) {
      try {
        await this.git.deleteLocalBranch(branchName, true);
      } catch {
        // Branch might not exist or be checked out elsewhere
      }
    }
  }

  /**
   * Prune stale worktree references
   */
  async prune(): Promise<void> {
    await this.git.raw(['worktree', 'prune']);
  }

  /**
   * Get the path for a worktree by name
   */
  getPath(name: string): string {
    return path.join(this.config.worktreesDir, name);
  }

  /**
   * Clean up all nexus worktrees
   */
  async cleanupAll(): Promise<void> {
    const worktrees = await this.list();

    for (const worktree of worktrees) {
      if (!worktree.isMain && worktree.path.includes('.nexus/worktrees')) {
        const name = path.basename(worktree.path);
        await this.remove(name, true);
      }
    }

    await this.prune();
  }
}
