import { useEffect } from 'react';
import { useAgentStore } from '../stores/agent-store';
import type { AgentEvent } from '@nexus/shared';

/**
 * Hook to subscribe to agent events from the main process
 * Sets up the event listener on mount and cleans up on unmount
 */
export function useAgentEvents() {
  const handleAgentEvent = useAgentStore((state) => state.handleAgentEvent);

  useEffect(() => {
    // Subscribe to agent events from main process
    const unsubscribe = window.nexus.on('agent:event', (data: unknown) => {
      const event = data as AgentEvent;
      handleAgentEvent(event);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [handleAgentEvent]);
}

/**
 * Hook to get the current agent's streaming text
 */
export function useAgentStreamingText(agentId: string | null): string {
  return useAgentStore((state) =>
    agentId ? state.agents.get(agentId)?.streamingText || '' : ''
  );
}

/**
 * Hook to get pending approvals for an agent
 */
export function useAgentPendingApprovals(agentId: string | null) {
  return useAgentStore((state) =>
    agentId ? state.agents.get(agentId)?.pendingApprovals || [] : []
  );
}
