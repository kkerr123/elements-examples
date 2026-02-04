// Core Types for Nexus Agent Orchestration Platform

// =============================================================================
// Agent Types
// =============================================================================

export type AgentStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'blocked'
  | 'needs_review'
  | 'done'
  | 'failed';

export type PermissionMode = 'explore' | 'ask' | 'auto';

export interface Agent {
  id: string;
  name: string;
  task: string;
  status: AgentStatus;
  template?: AgentTemplate;
  environment: AgentEnvironment;
  permissions: PermissionScope;
  createdAt: Date;
  updatedAt: Date;
  sessionId: string;
  projectId: string;
}

export interface AgentEnvironment {
  baseRef: string;
  worktreePath?: string;
  timeout?: number;
}

export interface PermissionScope {
  mode: PermissionMode;
  paths: string[];
  operations: ('read' | 'write' | 'delete' | 'execute')[];
  tools: string[];
  external: {
    network: boolean;
    apis: string[];
  };
}

export interface AgentTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  defaultPermissions: PermissionScope;
  defaultSources: string[];
  defaultSkills: string[];
  systemPrompt?: string;
}

// =============================================================================
// Session Types
// =============================================================================

export interface Session {
  id: string;
  agentId: string;
  title: string;
  status: AgentStatus;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  flagged: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startedAt: Date;
  completedAt?: Date;
}

// =============================================================================
// Project Types
// =============================================================================

export interface Project {
  id: string;
  name: string;
  path: string;
  agents: string[]; // Agent IDs
  sources: Source[];
  skills: Skill[];
  sharedContext: SharedContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedContext {
  projectId: string;
  entries: ContextEntry[];
}

export interface ContextEntry {
  id: string;
  type: 'discovery' | 'decision' | 'convention' | 'warning';
  content: string;
  source: {
    agentId: string;
    timestamp: Date;
    sessionId: string;
  };
  references: string[];
}

// =============================================================================
// Source & Skill Types
// =============================================================================

export interface Source {
  id: string;
  name: string;
  type: 'mcp' | 'rest' | 'filesystem' | 'database';
  config: Record<string, unknown>;
  permissions: PermissionScope;
  enabled: boolean;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  requiredSources: string[];
  exampleInvocations: string[];
}

// =============================================================================
// Checkpoint Types
// =============================================================================

export interface Checkpoint {
  id: string;
  agentId: string;
  sessionId: string;
  timestamp: Date;
  trigger: 'auto' | 'manual' | 'milestone';
  snapshot: {
    gitRef: string;
    workingTreeHash: string;
    conversationStateFile: string;
  };
  metadata: {
    filesChanged: string[];
    linesAdded: number;
    linesRemoved: number;
    description?: string;
  };
}

// =============================================================================
// IPC Types (Main <-> Renderer communication)
// =============================================================================

export type IpcChannel =
  | 'agent:spawn'
  | 'agent:pause'
  | 'agent:resume'
  | 'agent:terminate'
  | 'agent:status'
  | 'agent:approve'
  | 'agent:reject'
  | 'agent:list'
  | 'agent:sendMessage'
  | 'session:create'
  | 'session:list'
  | 'session:get'
  | 'session:message'
  | 'project:open'
  | 'project:list'
  | 'checkpoint:create'
  | 'checkpoint:restore'
  | 'checkpoint:list'
  | 'checkpoint:get'
  | 'checkpoint:delete'
  | 'checkpoint:diff';

// =============================================================================
// Agent Event Types (Main -> Renderer real-time events)
// =============================================================================

export type AgentEventType =
  | 'status'
  | 'message'
  | 'text'
  | 'tool_call'
  | 'tool_result'
  | 'approval_required'
  | 'turn_complete'
  | 'complete'
  | 'error';

export interface AgentEvent {
  agentId: string;
  type: AgentEventType;
  data: unknown;
}

export interface IpcRequest<T = unknown> {
  channel: IpcChannel;
  payload: T;
  requestId: string;
}

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
}

// =============================================================================
// UI State Types
// =============================================================================

export interface AppState {
  currentProject: Project | null;
  selectedAgentId: string | null;
  selectedSessionId: string | null;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface FleetState {
  agents: Agent[];
  maxConcurrent: number;
  queuedCount: number;
  runningCount: number;
}
