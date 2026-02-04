import * as path from 'path';
import * as fs from 'fs/promises';
import { Repository, RepositoryInfo, WorktreeManager } from '../git';
import type { Project, SharedContext, ContextEntry } from '@nexus/shared';

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  lastOpenedAt: Date;
}

export interface RecentProject {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: Date;
}

const NEXUS_DIR = '.nexus';
const PROJECT_CONFIG_FILE = 'project.json';
const SESSIONS_DIR = 'sessions';
const CHECKPOINTS_DIR = 'checkpoints';
const CONTEXT_FILE = 'context.json';

/**
 * Manages project lifecycle and state
 */
export class ProjectManager {
  private repo: Repository | null = null;
  private worktreeManager: WorktreeManager | null = null;
  private config: ProjectConfig | null = null;
  private projectPath: string | null = null;

  /**
   * Open a project from a directory path
   */
  async open(dirPath: string): Promise<Project> {
    // Validate it's a git repository
    const isRepo = await Repository.isGitRepository(dirPath);
    if (!isRepo) {
      throw new Error(`Not a git repository: ${dirPath}`);
    }

    this.projectPath = dirPath;
    this.repo = await Repository.open(dirPath);
    this.worktreeManager = new WorktreeManager(dirPath);

    // Ensure .nexus directory structure exists
    await this.ensureNexusDir();

    // Load or create project config
    this.config = await this.loadOrCreateConfig();

    // Update last opened time
    this.config.lastOpenedAt = new Date();
    await this.saveConfig();

    // Load shared context
    const sharedContext = await this.loadSharedContext();

    return {
      id: this.config.id,
      name: this.config.name,
      path: this.projectPath,
      agents: [],
      sources: [],
      skills: [],
      sharedContext,
      createdAt: this.config.createdAt,
      updatedAt: this.config.lastOpenedAt,
    };
  }

  /**
   * Get the currently open project's repository
   */
  getRepository(): Repository {
    if (!this.repo) {
      throw new Error('No project is currently open');
    }
    return this.repo;
  }

  /**
   * Get the worktree manager for the current project
   */
  getWorktreeManager(): WorktreeManager {
    if (!this.worktreeManager) {
      throw new Error('No project is currently open');
    }
    return this.worktreeManager;
  }

  /**
   * Close the current project
   */
  async close(): Promise<void> {
    this.repo = null;
    this.worktreeManager = null;
    this.config = null;
    this.projectPath = null;
  }

  /**
   * Check if a project is currently open
   */
  isOpen(): boolean {
    return this.repo !== null;
  }

  /**
   * Get repository info for the current project
   */
  async getRepositoryInfo(): Promise<RepositoryInfo> {
    return this.getRepository().getInfo();
  }

  /**
   * Ensure .nexus directory structure exists
   */
  private async ensureNexusDir(): Promise<void> {
    if (!this.projectPath) return;

    const nexusDir = path.join(this.projectPath, NEXUS_DIR);
    const sessionsDir = path.join(nexusDir, SESSIONS_DIR);
    const checkpointsDir = path.join(nexusDir, CHECKPOINTS_DIR);

    await fs.mkdir(nexusDir, { recursive: true });
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.mkdir(checkpointsDir, { recursive: true });
  }

  /**
   * Load or create project configuration
   */
  private async loadOrCreateConfig(): Promise<ProjectConfig> {
    if (!this.projectPath) {
      throw new Error('No project path set');
    }

    const configPath = path.join(this.projectPath, NEXUS_DIR, PROJECT_CONFIG_FILE);

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      return {
        ...config,
        createdAt: new Date(config.createdAt),
        lastOpenedAt: new Date(config.lastOpenedAt),
      };
    } catch {
      // Create new config
      const config: ProjectConfig = {
        id: crypto.randomUUID(),
        name: path.basename(this.projectPath),
        path: this.projectPath,
        createdAt: new Date(),
        lastOpenedAt: new Date(),
      };
      return config;
    }
  }

  /**
   * Save project configuration
   */
  private async saveConfig(): Promise<void> {
    if (!this.projectPath || !this.config) return;

    const configPath = path.join(this.projectPath, NEXUS_DIR, PROJECT_CONFIG_FILE);
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Load shared context
   */
  private async loadSharedContext(): Promise<SharedContext> {
    if (!this.projectPath || !this.config) {
      return { projectId: '', entries: [] };
    }

    const contextPath = path.join(this.projectPath, NEXUS_DIR, CONTEXT_FILE);

    try {
      const content = await fs.readFile(contextPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        projectId: this.config.id,
        entries: [],
      };
    }
  }

  /**
   * Save shared context
   */
  async saveSharedContext(context: SharedContext): Promise<void> {
    if (!this.projectPath) return;

    const contextPath = path.join(this.projectPath, NEXUS_DIR, CONTEXT_FILE);
    await fs.writeFile(contextPath, JSON.stringify(context, null, 2));
  }

  /**
   * Add an entry to shared context
   */
  async addContextEntry(entry: Omit<ContextEntry, 'id'>): Promise<ContextEntry> {
    const context = await this.loadSharedContext();
    const newEntry: ContextEntry = {
      ...entry,
      id: crypto.randomUUID(),
    };
    context.entries.push(newEntry);
    await this.saveSharedContext(context);
    return newEntry;
  }

  /**
   * Get sessions directory path
   */
  getSessionsDir(): string {
    if (!this.projectPath) {
      throw new Error('No project is currently open');
    }
    return path.join(this.projectPath, NEXUS_DIR, SESSIONS_DIR);
  }

  /**
   * Get checkpoints directory path
   */
  getCheckpointsDir(): string {
    if (!this.projectPath) {
      throw new Error('No project is currently open');
    }
    return path.join(this.projectPath, NEXUS_DIR, CHECKPOINTS_DIR);
  }
}

// Singleton instance
export const projectManager = new ProjectManager();
