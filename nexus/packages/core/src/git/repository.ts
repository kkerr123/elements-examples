import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface GitBranch {
  name: string;
  current: boolean;
  commit: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

export interface RepositoryInfo {
  path: string;
  name: string;
  currentBranch: string;
  isDirty: boolean;
  branches: GitBranch[];
  recentCommits: GitCommit[];
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isMain: boolean;
}

export class Repository {
  private git: SimpleGit;
  readonly path: string;

  constructor(repoPath: string) {
    this.path = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Check if a directory is a valid git repository
   */
  static async isGitRepository(dirPath: string): Promise<boolean> {
    try {
      const git = simpleGit(dirPath);
      await git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Open a repository and get its info
   */
  static async open(dirPath: string): Promise<Repository> {
    const isRepo = await Repository.isGitRepository(dirPath);
    if (!isRepo) {
      throw new Error(`Not a git repository: ${dirPath}`);
    }
    return new Repository(dirPath);
  }

  /**
   * Get repository name from path
   */
  get name(): string {
    return path.basename(this.path);
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'HEAD';
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<StatusResult> {
    return this.git.status();
  }

  /**
   * Check if repository has uncommitted changes
   */
  async isDirty(): Promise<boolean> {
    const status = await this.git.status();
    return !status.isClean();
  }

  /**
   * Get all local branches
   */
  async getBranches(): Promise<GitBranch[]> {
    const branchSummary = await this.git.branchLocal();
    return Object.entries(branchSummary.branches).map(([name, info]) => ({
      name,
      current: info.current,
      commit: info.commit,
    }));
  }

  /**
   * Get recent commits
   */
  async getRecentCommits(count: number = 10): Promise<GitCommit[]> {
    const log = await this.git.log({ maxCount: count });
    return log.all.map((commit) => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      date: new Date(commit.date),
    }));
  }

  /**
   * Get full repository info
   */
  async getInfo(): Promise<RepositoryInfo> {
    const [currentBranch, isDirty, branches, recentCommits] = await Promise.all([
      this.getCurrentBranch(),
      this.isDirty(),
      this.getBranches(),
      this.getRecentCommits(5),
    ]);

    return {
      path: this.path,
      name: this.name,
      currentBranch,
      isDirty,
      branches,
      recentCommits,
    };
  }

  /**
   * Get diff for a file
   */
  async getFileDiff(filePath: string): Promise<string> {
    return this.git.diff(['--', filePath]);
  }

  /**
   * Get all changed files
   */
  async getChangedFiles(): Promise<string[]> {
    const status = await this.git.status();
    return [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.renamed.map((r) => r.to),
    ];
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, startPoint?: string): Promise<void> {
    if (startPoint) {
      await this.git.checkoutBranch(branchName, startPoint);
    } else {
      await this.git.checkoutLocalBranch(branchName);
    }
  }

  /**
   * Checkout a branch
   */
  async checkout(branchName: string): Promise<void> {
    await this.git.checkout(branchName);
  }

  /**
   * Stage files
   */
  async add(files: string | string[]): Promise<void> {
    await this.git.add(files);
  }

  /**
   * Commit changes
   */
  async commit(message: string): Promise<string> {
    const result = await this.git.commit(message);
    return result.commit;
  }

  /**
   * Get the root directory of the git repository
   */
  async getRoot(): Promise<string> {
    const root = await this.git.revparse(['--show-toplevel']);
    return root.trim();
  }
}
