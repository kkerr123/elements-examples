import { create } from 'zustand';
import type { AgentEvent, AgentEventType } from '@nexus/shared';

// =============================================================================
// Types
// =============================================================================

export type AgentStatus = 'idle' | 'running' | 'paused' | 'awaiting_approval' | 'completed' | 'failed';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
}

export interface ToolCallResult {
  toolCallId: string;
  output: string;
  isError: boolean;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolCallResult[];
}

export interface AgentInfo {
  id: string;
  name: string;
  status: AgentStatus;
  currentTask?: string;
  workingDirectory?: string;
  messages: AgentMessage[];
  pendingApprovals: ToolCall[];
  streamingText: string;
  turnCount: number;
  tokensUsed: {
    input: number;
    output: number;
  };
}

export interface AgentStore {
  // State
  agents: Map<string, AgentInfo>;
  selectedAgentId: string | null;

  // Actions
  selectAgent: (agentId: string | null) => void;
  addAgent: (agent: AgentInfo) => void;
  removeAgent: (agentId: string) => void;
  updateAgent: (agentId: string, updates: Partial<AgentInfo>) => void;
  handleAgentEvent: (event: AgentEvent) => void;
  clearStreamingText: (agentId: string) => void;

  // Selectors
  getAgent: (agentId: string) => AgentInfo | undefined;
  getSelectedAgent: () => AgentInfo | undefined;
  getRunningAgents: () => AgentInfo[];
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: new Map(),
  selectedAgentId: null,

  selectAgent: (agentId) => {
    set({ selectedAgentId: agentId });
  },

  addAgent: (agent) => {
    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.set(agent.id, agent);
      return { agents: newAgents };
    });
  },

  removeAgent: (agentId) => {
    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.delete(agentId);
      return {
        agents: newAgents,
        selectedAgentId: state.selectedAgentId === agentId ? null : state.selectedAgentId,
      };
    });
  },

  updateAgent: (agentId, updates) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, ...updates });
      return { agents: newAgents };
    });
  },

  handleAgentEvent: (event) => {
    const { agentId, type, data } = event;
    const state = get();
    const agent = state.agents.get(agentId);

    if (!agent) {
      // Create a new agent entry for events from unknown agents
      const newAgent: AgentInfo = {
        id: agentId,
        name: 'Unknown Agent',
        status: 'running',
        messages: [],
        pendingApprovals: [],
        streamingText: '',
        turnCount: 0,
        tokensUsed: { input: 0, output: 0 },
      };
      state.addAgent(newAgent);
    }

    switch (type) {
      case 'status':
        state.updateAgent(agentId, { status: data as AgentStatus });
        break;

      case 'message':
        const message = data as AgentMessage;
        set((s) => {
          const currentAgent = s.agents.get(agentId);
          if (!currentAgent) return s;

          const newAgents = new Map(s.agents);
          newAgents.set(agentId, {
            ...currentAgent,
            messages: [...currentAgent.messages, message],
            streamingText: '', // Clear streaming text when full message arrives
          });
          return { agents: newAgents };
        });
        break;

      case 'text':
        // Append streaming text
        set((s) => {
          const currentAgent = s.agents.get(agentId);
          if (!currentAgent) return s;

          const newAgents = new Map(s.agents);
          newAgents.set(agentId, {
            ...currentAgent,
            streamingText: currentAgent.streamingText + (data as string),
          });
          return { agents: newAgents };
        });
        break;

      case 'tool_call':
        const toolCall = data as ToolCall;
        set((s) => {
          const currentAgent = s.agents.get(agentId);
          if (!currentAgent) return s;

          const newAgents = new Map(s.agents);
          newAgents.set(agentId, {
            ...currentAgent,
            pendingApprovals: [...currentAgent.pendingApprovals, toolCall],
          });
          return { agents: newAgents };
        });
        break;

      case 'tool_result':
        const result = data as ToolCallResult;
        set((s) => {
          const currentAgent = s.agents.get(agentId);
          if (!currentAgent) return s;

          // Remove from pending approvals
          const newAgents = new Map(s.agents);
          newAgents.set(agentId, {
            ...currentAgent,
            pendingApprovals: currentAgent.pendingApprovals.filter(
              (tc) => tc.id !== result.toolCallId
            ),
          });
          return { agents: newAgents };
        });
        break;

      case 'approval_required':
        const toolCalls = data as ToolCall[];
        set((s) => {
          const currentAgent = s.agents.get(agentId);
          if (!currentAgent) return s;

          const newAgents = new Map(s.agents);
          newAgents.set(agentId, {
            ...currentAgent,
            pendingApprovals: toolCalls,
            status: 'awaiting_approval',
          });
          return { agents: newAgents };
        });
        break;

      case 'turn_complete':
        state.updateAgent(agentId, { turnCount: data as number });
        break;

      case 'complete':
        const finalState = data as { status: AgentStatus; messages: AgentMessage[]; tokensUsed: { input: number; output: number } };
        state.updateAgent(agentId, {
          status: 'completed',
          messages: finalState.messages,
          tokensUsed: finalState.tokensUsed,
        });
        break;

      case 'error':
        state.updateAgent(agentId, {
          status: 'failed',
        });
        break;
    }
  },

  clearStreamingText: (agentId) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, streamingText: '' });
      return { agents: newAgents };
    });
  },

  getAgent: (agentId) => {
    return get().agents.get(agentId);
  },

  getSelectedAgent: () => {
    const state = get();
    return state.selectedAgentId ? state.agents.get(state.selectedAgentId) : undefined;
  },

  getRunningAgents: () => {
    return Array.from(get().agents.values()).filter(
      (agent) => agent.status === 'running' || agent.status === 'awaiting_approval'
    );
  },
}));
