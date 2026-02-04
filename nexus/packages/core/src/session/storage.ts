import * as path from 'path';
import * as fs from 'fs/promises';
import * as readline from 'readline';
import { createReadStream, createWriteStream } from 'fs';
import type { Session, Message, ToolCall, AgentStatus } from '@nexus/shared';

export interface SessionMetadata {
  id: string;
  agentId: string;
  title: string;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  flagged: boolean;
  messageCount: number;
}

/**
 * Handles reading/writing session data in JSONL format
 */
export class SessionStorage {
  private sessionsDir: string;

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
  }

  /**
   * Get path to session file
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.jsonl`);
  }

  /**
   * Get path to session metadata file
   */
  private getMetadataPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.meta.json`);
  }

  /**
   * Create a new session
   */
  async create(
    agentId: string,
    title: string = 'New Session'
  ): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      agentId,
      title,
      status: 'queued',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      flagged: false,
    };

    await this.saveMetadata(session);
    return session;
  }

  /**
   * Save session metadata
   */
  private async saveMetadata(session: Session): Promise<void> {
    const metadata: SessionMetadata = {
      id: session.id,
      agentId: session.agentId,
      title: session.title,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      archived: session.archived,
      flagged: session.flagged,
      messageCount: session.messages.length,
    };

    const metaPath = this.getMetadataPath(session.id);
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Append a message to session file (JSONL format)
   */
  async appendMessage(sessionId: string, message: Message): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    const line = JSON.stringify({
      type: 'message',
      data: {
        ...message,
        timestamp: message.timestamp.toISOString(),
      },
    }) + '\n';

    await fs.appendFile(sessionPath, line);
  }

  /**
   * Update session metadata
   */
  async updateMetadata(
    sessionId: string,
    updates: Partial<Omit<Session, 'id' | 'messages'>>
  ): Promise<void> {
    const metaPath = this.getMetadataPath(sessionId);

    try {
      const content = await fs.readFile(metaPath, 'utf-8');
      const metadata: SessionMetadata = JSON.parse(content);

      const updated: SessionMetadata = {
        ...metadata,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      if (updates.status) updated.status = updates.status;
      if (updates.title) updated.title = updates.title;
      if (updates.archived !== undefined) updated.archived = updates.archived;
      if (updates.flagged !== undefined) updated.flagged = updates.flagged;

      await fs.writeFile(metaPath, JSON.stringify(updated, null, 2));
    } catch (error) {
      throw new Error(`Failed to update session metadata: ${sessionId}`);
    }
  }

  /**
   * Load a full session with all messages
   */
  async load(sessionId: string): Promise<Session | null> {
    const metaPath = this.getMetadataPath(sessionId);
    const sessionPath = this.getSessionPath(sessionId);

    try {
      // Load metadata
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const metadata: SessionMetadata = JSON.parse(metaContent);

      // Load messages from JSONL
      const messages: Message[] = [];

      try {
        const fileStream = createReadStream(sessionPath);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        for await (const line of rl) {
          if (line.trim()) {
            const entry = JSON.parse(line);
            if (entry.type === 'message') {
              messages.push({
                ...entry.data,
                timestamp: new Date(entry.data.timestamp),
              });
            }
          }
        }
      } catch {
        // No messages file yet, that's ok
      }

      return {
        id: metadata.id,
        agentId: metadata.agentId,
        title: metadata.title,
        status: metadata.status,
        messages,
        createdAt: new Date(metadata.createdAt),
        updatedAt: new Date(metadata.updatedAt),
        archived: metadata.archived,
        flagged: metadata.flagged,
      };
    } catch {
      return null;
    }
  }

  /**
   * List all sessions (metadata only)
   */
  async list(): Promise<SessionMetadata[]> {
    const files = await fs.readdir(this.sessionsDir);
    const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

    const sessions: SessionMetadata[] = [];

    for (const file of metaFiles) {
      try {
        const content = await fs.readFile(
          path.join(this.sessionsDir, file),
          'utf-8'
        );
        sessions.push(JSON.parse(content));
      } catch {
        // Skip invalid files
      }
    }

    // Sort by updatedAt descending
    sessions.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return sessions;
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    const metaPath = this.getMetadataPath(sessionId);
    const sessionPath = this.getSessionPath(sessionId);

    try {
      await fs.unlink(metaPath);
    } catch {
      // Ignore if doesn't exist
    }

    try {
      await fs.unlink(sessionPath);
    } catch {
      // Ignore if doesn't exist
    }
  }

  /**
   * Archive a session
   */
  async archive(sessionId: string): Promise<void> {
    await this.updateMetadata(sessionId, { archived: true });
  }

  /**
   * Unarchive a session
   */
  async unarchive(sessionId: string): Promise<void> {
    await this.updateMetadata(sessionId, { archived: false });
  }

  /**
   * Toggle session flag
   */
  async toggleFlag(sessionId: string): Promise<boolean> {
    const session = await this.load(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const newFlagged = !session.flagged;
    await this.updateMetadata(sessionId, { flagged: newFlagged });
    return newFlagged;
  }
}
