import * as path from 'path';
import * as fs from 'fs/promises';
import { simpleGit, type SimpleGit } from 'simple-git';
import * as zlib from 'zlib';
import { promisify } from 'util';
import type { Checkpoint } from '@nexus/shared';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// =============================================================================
// Types
// =============================================================================

export interface CheckpointMetadata {
  id: string;
  agentId: string;
  sessionId: string;
  timestamp: string;
  trigger: 'auto' | 'manual' | 'milestone';
  description?: string;
  gitRef: string;
  conversationFile: string;
  filesChanged: string[];
  linesAdded: number;
  linesRemoved: number;
}

export interface ConversationState {
  sessionId: string;
  messages: unknown[];
  agentState: unknown;
  timestamp: string;
}

// =============================================================================
// Checkpoint Manager
// =============================================================================

const CHECKPOINT_REF_PREFIX = 'refs/nexus/checkpoints';

/**
 * Manages checkpoints for agent state restoration
 * Uses git refs for versioning and gzip compression for conversation state
 */
export class CheckpointManager {
  private repoPath: string;
  private checkpointsDir: string;
  private git: SimpleGit;

  constructor(repoPath: string, checkpointsDir: string) {
    this.repoPath = repoPath;
    this.checkpointsDir = checkpointsDir;
    this.git = simpleGit(repoPath);
  }

  /**
   * Initialize the checkpoints directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.checkpointsDir, { recursive: true });
  }

  /**
   * Create a new checkpoint
   */
  async create(options: {
    agentId: string;
    sessionId: string;
    trigger: 'auto' | 'manual' | 'milestone';
    description?: string;
    conversationState: ConversationState;
    worktreePath?: string;
  }): Promise<CheckpointMetadata> {
    const checkpointId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Use the worktree path if provided, otherwise use main repo
    const gitPath = options.worktreePath || this.repoPath;
    const git = simpleGit(gitPath);

    // Get current HEAD commit
    const headRef = await git.revparse(['HEAD']);

    // Get diff stats if there are uncommitted changes
    let filesChanged: string[] = [];
    let linesAdded = 0;
    let linesRemoved = 0;

    const status = await git.status();
    if (!status.isClean()) {
      // Stage all changes temporarily to get accurate stats
      const diffSummary = await git.diffSummary();
      filesChanged = diffSummary.files.map((f) => f.file);
      linesAdded = diffSummary.insertions;
      linesRemoved = diffSummary.deletions;
    }

    // Create a checkpoint commit with all current changes
    const refName = `${CHECKPOINT_REF_PREFIX}/${options.agentId}/${checkpointId}`;

    if (!status.isClean()) {
      // Stash current changes, create checkpoint, then restore
      await git.stash(['push', '-m', `checkpoint-${checkpointId}`]);

      try {
        // Create a tree from the stash
        const stashRef = await git.revparse(['stash@{0}']);

        // Create the checkpoint ref pointing to the stash
        await git.raw(['update-ref', refName, stashRef]);
      } finally {
        // Restore the stash
        await git.stash(['pop']);
      }
    } else {
      // No changes, just point to HEAD
      await git.raw(['update-ref', refName, headRef]);
    }

    // Save conversation state as compressed JSON
    const conversationFile = `${checkpointId}.conv.gz`;
    const conversationPath = path.join(this.checkpointsDir, conversationFile);

    const conversationJson = JSON.stringify(options.conversationState);
    const compressed = await gzip(Buffer.from(conversationJson));
    await fs.writeFile(conversationPath, compressed);

    // Create checkpoint metadata
    const metadata: CheckpointMetadata = {
      id: checkpointId,
      agentId: options.agentId,
      sessionId: options.sessionId,
      timestamp,
      trigger: options.trigger,
      description: options.description,
      gitRef: refName,
      conversationFile,
      filesChanged,
      linesAdded,
      linesRemoved,
    };

    // Save metadata
    const metadataPath = path.join(this.checkpointsDir, `${checkpointId}.meta.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return metadata;
  }

  /**
   * Get checkpoint metadata by ID
   */
  async get(checkpointId: string): Promise<CheckpointMetadata | null> {
    const metadataPath = path.join(this.checkpointsDir, `${checkpointId}.meta.json`);

    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * List all checkpoints for an agent
   */
  async listByAgent(agentId: string): Promise<CheckpointMetadata[]> {
    const files = await fs.readdir(this.checkpointsDir);
    const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

    const checkpoints: CheckpointMetadata[] = [];

    for (const file of metaFiles) {
      try {
        const content = await fs.readFile(
          path.join(this.checkpointsDir, file),
          'utf-8'
        );
        const metadata: CheckpointMetadata = JSON.parse(content);
        if (metadata.agentId === agentId) {
          checkpoints.push(metadata);
        }
      } catch {
        // Skip invalid files
      }
    }

    // Sort by timestamp descending
    checkpoints.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return checkpoints;
  }

  /**
   * List all checkpoints for a session
   */
  async listBySession(sessionId: string): Promise<CheckpointMetadata[]> {
    const files = await fs.readdir(this.checkpointsDir);
    const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

    const checkpoints: CheckpointMetadata[] = [];

    for (const file of metaFiles) {
      try {
        const content = await fs.readFile(
          path.join(this.checkpointsDir, file),
          'utf-8'
        );
        const metadata: CheckpointMetadata = JSON.parse(content);
        if (metadata.sessionId === sessionId) {
          checkpoints.push(metadata);
        }
      } catch {
        // Skip invalid files
      }
    }

    // Sort by timestamp descending
    checkpoints.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return checkpoints;
  }

  /**
   * Load conversation state from a checkpoint
   */
  async loadConversationState(checkpointId: string): Promise<ConversationState | null> {
    const metadata = await this.get(checkpointId);
    if (!metadata) return null;

    const conversationPath = path.join(this.checkpointsDir, metadata.conversationFile);

    try {
      const compressed = await fs.readFile(conversationPath);
      const decompressed = await gunzip(compressed);
      return JSON.parse(decompressed.toString());
    } catch {
      return null;
    }
  }

  /**
   * Restore a checkpoint to a worktree
   */
  async restore(
    checkpointId: string,
    targetPath: string
  ): Promise<{ success: boolean; error?: string }> {
    const metadata = await this.get(checkpointId);
    if (!metadata) {
      return { success: false, error: 'Checkpoint not found' };
    }

    const git = simpleGit(targetPath);

    try {
      // Check if the target has uncommitted changes
      const status = await git.status();
      if (!status.isClean()) {
        return {
          success: false,
          error: 'Target has uncommitted changes. Please commit or stash them first.',
        };
      }

      // Checkout the checkpoint ref
      await git.raw(['checkout', metadata.gitRef]);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get diff between two checkpoints
   */
  async diff(
    fromCheckpointId: string,
    toCheckpointId: string
  ): Promise<string | null> {
    const fromMeta = await this.get(fromCheckpointId);
    const toMeta = await this.get(toCheckpointId);

    if (!fromMeta || !toMeta) return null;

    try {
      const diff = await this.git.diff([fromMeta.gitRef, toMeta.gitRef]);
      return diff;
    } catch {
      return null;
    }
  }

  /**
   * Delete a checkpoint
   */
  async delete(checkpointId: string): Promise<void> {
    const metadata = await this.get(checkpointId);
    if (!metadata) return;

    // Delete the git ref
    try {
      await this.git.raw(['update-ref', '-d', metadata.gitRef]);
    } catch {
      // Ref may not exist
    }

    // Delete the conversation file
    try {
      await fs.unlink(path.join(this.checkpointsDir, metadata.conversationFile));
    } catch {
      // File may not exist
    }

    // Delete the metadata file
    try {
      await fs.unlink(path.join(this.checkpointsDir, `${checkpointId}.meta.json`));
    } catch {
      // File may not exist
    }
  }

  /**
   * Cleanup old checkpoints (keep the most recent N per agent)
   */
  async cleanup(maxPerAgent: number = 10): Promise<number> {
    const files = await fs.readdir(this.checkpointsDir);
    const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

    // Group checkpoints by agent
    const byAgent = new Map<string, CheckpointMetadata[]>();

    for (const file of metaFiles) {
      try {
        const content = await fs.readFile(
          path.join(this.checkpointsDir, file),
          'utf-8'
        );
        const metadata: CheckpointMetadata = JSON.parse(content);

        if (!byAgent.has(metadata.agentId)) {
          byAgent.set(metadata.agentId, []);
        }
        byAgent.get(metadata.agentId)!.push(metadata);
      } catch {
        // Skip invalid files
      }
    }

    let deletedCount = 0;

    // For each agent, keep only the most recent N checkpoints
    for (const checkpoints of byAgent.values()) {
      // Sort by timestamp descending
      checkpoints.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Delete older checkpoints
      for (let i = maxPerAgent; i < checkpoints.length; i++) {
        await this.delete(checkpoints[i].id);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
