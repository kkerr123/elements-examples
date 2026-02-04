import type { IpcChannel, IpcResponse } from '@nexus/shared';

/**
 * Type-safe IPC client for communicating with the main process
 */
export const ipc = {
  /**
   * Invoke an IPC channel with a payload
   */
  async invoke<T = unknown, R = unknown>(
    channel: IpcChannel,
    payload?: T
  ): Promise<R> {
    const response = await window.nexus.invoke<T, R>(channel, payload as T);
    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }
    return response.data as R;
  },

  /**
   * Subscribe to an event channel
   */
  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    return window.nexus.on(channel, callback);
  },
};

// =============================================================================
// Agent IPC Methods
// =============================================================================

export interface SpawnAgentParams {
  name: string;
  task: string;
  permissionMode?: 'explore' | 'ask' | 'auto';
  sessionId?: string;
  useWorktree?: boolean;
}

export interface SpawnAgentResult {
  id: string;
  name: string;
  status: string;
  workingDirectory: string;
}

export const agentApi = {
  /**
   * Spawn a new agent
   */
  async spawn(params: SpawnAgentParams): Promise<SpawnAgentResult> {
    return ipc.invoke('agent:spawn', params);
  },

  /**
   * Pause an agent
   */
  async pause(agentId: string): Promise<{ success: boolean; status: string }> {
    return ipc.invoke('agent:pause', { agentId });
  },

  /**
   * Resume an agent
   */
  async resume(agentId: string): Promise<{ success: boolean; status: string }> {
    return ipc.invoke('agent:resume', { agentId });
  },

  /**
   * Terminate an agent
   */
  async terminate(agentId: string): Promise<{ success: boolean }> {
    return ipc.invoke('agent:terminate', { agentId });
  },

  /**
   * Get agent status
   */
  async getStatus(agentId: string): Promise<unknown> {
    return ipc.invoke('agent:status', { agentId });
  },

  /**
   * Approve tool calls
   */
  async approve(agentId: string, toolCallIds: string[]): Promise<{ success: boolean }> {
    return ipc.invoke('agent:approve', { agentId, toolCallIds });
  },

  /**
   * Reject tool calls
   */
  async reject(agentId: string, toolCallIds: string[]): Promise<{ success: boolean }> {
    return ipc.invoke('agent:reject', { agentId, toolCallIds });
  },

  /**
   * List all agents
   */
  async list(): Promise<{ agents: Array<{ id: string; name: string; status: string; currentTask?: string; turnCount: number }> }> {
    return ipc.invoke('agent:list', {});
  },

  /**
   * Send a message to an agent
   */
  async sendMessage(agentId: string, message: string): Promise<{ success: boolean }> {
    return ipc.invoke('agent:sendMessage', { agentId, message });
  },
};

// =============================================================================
// Project IPC Methods
// =============================================================================

export const projectApi = {
  /**
   * Open a project (shows file picker if no path provided)
   */
  async open(path?: string): Promise<{ project: unknown; repoInfo: unknown }> {
    return ipc.invoke('project:open', { path });
  },

  /**
   * List recent projects
   */
  async list(): Promise<{ projects: Array<{ id: string; name: string; path: string; lastOpenedAt: string }> }> {
    return ipc.invoke('project:list', {});
  },
};

// =============================================================================
// Session IPC Methods
// =============================================================================

export const sessionApi = {
  /**
   * Create a new session
   */
  async create(agentId: string, title?: string): Promise<unknown> {
    return ipc.invoke('session:create', { agentId, title });
  },

  /**
   * List all sessions
   */
  async list(): Promise<{ sessions: unknown[] }> {
    return ipc.invoke('session:list', {});
  },

  /**
   * Get a specific session
   */
  async get(sessionId: string): Promise<unknown> {
    return ipc.invoke('session:get', { sessionId });
  },
};

// =============================================================================
// Checkpoint IPC Methods
// =============================================================================

export const checkpointApi = {
  /**
   * Create a checkpoint
   */
  async create(params: {
    agentId: string;
    sessionId: string;
    trigger?: 'auto' | 'manual' | 'milestone';
    description?: string;
  }): Promise<unknown> {
    return ipc.invoke('checkpoint:create', params);
  },

  /**
   * Restore a checkpoint
   */
  async restore(checkpointId: string, targetPath?: string): Promise<{ success: boolean; conversationState: unknown }> {
    return ipc.invoke('checkpoint:restore', { checkpointId, targetPath });
  },

  /**
   * List checkpoints
   */
  async list(params?: { agentId?: string; sessionId?: string }): Promise<{ checkpoints: unknown[] }> {
    return ipc.invoke('checkpoint:list', params || {});
  },

  /**
   * Get a checkpoint
   */
  async get(checkpointId: string): Promise<unknown> {
    return ipc.invoke('checkpoint:get', { checkpointId });
  },

  /**
   * Delete a checkpoint
   */
  async delete(checkpointId: string): Promise<{ success: boolean }> {
    return ipc.invoke('checkpoint:delete', { checkpointId });
  },

  /**
   * Get diff between checkpoints
   */
  async diff(fromCheckpointId: string, toCheckpointId: string): Promise<{ diff: string | null }> {
    return ipc.invoke('checkpoint:diff', { fromCheckpointId, toCheckpointId });
  },
};

// =============================================================================
// Settings IPC Methods
// =============================================================================

export const settingsApi = {
  /**
   * Get all settings
   */
  async get(): Promise<unknown> {
    const response = await window.nexus.invoke('settings:get' as IpcChannel, {});
    if (!response.success) throw new Error(response.error);
    return response.data;
  },

  /**
   * Set a setting value
   */
  async set(key: string, value: unknown): Promise<void> {
    const response = await window.nexus.invoke('settings:set' as IpcChannel, { key, value });
    if (!response.success) throw new Error(response.error);
  },

  /**
   * Check if API key is configured
   */
  async hasApiKey(): Promise<boolean> {
    const response = await window.nexus.invoke('settings:getApiKey' as IpcChannel, {});
    if (!response.success) throw new Error(response.error);
    return (response.data as { hasKey: boolean }).hasKey;
  },

  /**
   * Set API key
   */
  async setApiKey(apiKey: string): Promise<void> {
    const response = await window.nexus.invoke('settings:setApiKey' as IpcChannel, { apiKey });
    if (!response.success) throw new Error(response.error);
  },
};
