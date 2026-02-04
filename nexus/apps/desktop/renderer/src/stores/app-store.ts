import { create } from 'zustand';
import type { Agent, Project, Session, AgentStatus } from '@nexus/shared';

interface AppState {
  // Current selections
  currentProject: Project | null;
  selectedAgentId: string | null;
  selectedSessionId: string | null;

  // UI state
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';

  // Fleet state
  agents: Agent[];
  sessions: Session[];

  // Actions
  setCurrentProject: (project: Project | null) => void;
  selectAgent: (agentId: string | null) => void;
  selectSession: (sessionId: string | null) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Agent actions
  addAgent: (agent: Agent) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  removeAgent: (agentId: string) => void;

  // Session actions
  addSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  currentProject: null,
  selectedAgentId: null,
  selectedSessionId: null,
  sidebarCollapsed: false,
  theme: 'dark',
  agents: [],
  sessions: [],

  // Actions
  setCurrentProject: (project) => set({ currentProject: project }),

  selectAgent: (agentId) =>
    set({ selectedAgentId: agentId }),

  selectSession: (sessionId) =>
    set({ selectedSessionId: sessionId }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setTheme: (theme) => set({ theme }),

  addAgent: (agent) =>
    set((state) => ({ agents: [...state.agents, agent] })),

  updateAgentStatus: (agentId, status) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, status, updatedAt: new Date() } : a
      ),
    })),

  removeAgent: (agentId) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== agentId),
    })),

  addSession: (session) =>
    set((state) => ({ sessions: [...state.sessions, session] })),

  updateSession: (sessionId, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, ...updates, updatedAt: new Date() } : s
      ),
    })),
}));

// Selectors for derived state
export const useRunningAgents = () =>
  useAppStore((state) => state.agents.filter((a) => a.status === 'running'));

export const useQueuedAgents = () =>
  useAppStore((state) => state.agents.filter((a) => a.status === 'queued'));

export const useSelectedAgent = () =>
  useAppStore((state) =>
    state.agents.find((a) => a.id === state.selectedAgentId)
  );

export const useSelectedSession = () =>
  useAppStore((state) =>
    state.sessions.find((s) => s.id === state.selectedSessionId)
  );
