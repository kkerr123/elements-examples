import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { LLMClient, type Tool, type ToolResult, type StreamCallbacks, type LLMResponse } from '../llm/client';
import { getAllTools, executeTool, type ToolContext } from '../tools';
import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

export type AgentStatus = 'idle' | 'running' | 'paused' | 'awaiting_approval' | 'completed' | 'failed';

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  workingDirectory: string;
  permissionMode: 'explore' | 'ask' | 'auto';
  maxTurns?: number;
  tools?: Tool[];
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolCallResult[];
}

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

export interface AgentState {
  status: AgentStatus;
  messages: AgentMessage[];
  currentTask?: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  turnCount: number;
  pendingApprovals: ToolCall[];
}

// Events emitted by the agent
export interface AgentEvents {
  'status': (status: AgentStatus) => void;
  'message': (message: AgentMessage) => void;
  'text': (text: string) => void;
  'tool_call': (toolCall: ToolCall) => void;
  'tool_result': (result: ToolCallResult) => void;
  'approval_required': (toolCalls: ToolCall[]) => void;
  'turn_complete': (turnNumber: number) => void;
  'complete': (state: AgentState) => void;
  'error': (error: Error) => void;
}

// =============================================================================
// Agent Runtime
// =============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant that can read and write files, run commands, and help with software development tasks.

When working on tasks:
1. First understand the current state by reading relevant files
2. Plan your approach before making changes
3. Make changes incrementally and verify each step
4. Report your progress and any issues encountered

Always explain what you're doing and why.`;

const MAX_TURNS_DEFAULT = 50;

/**
 * Agent runtime that manages the conversation loop with tool execution
 */
export class AgentRuntime extends EventEmitter {
  private config: AgentConfig;
  private llmClient: LLMClient;
  private state: AgentState;
  private toolContext: ToolContext;
  private conversationHistory: MessageParam[];
  private abortController: AbortController | null = null;

  constructor(config: AgentConfig, apiKey: string) {
    super();
    this.config = {
      ...config,
      systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      maxTurns: config.maxTurns || MAX_TURNS_DEFAULT,
    };

    this.llmClient = new LLMClient({ apiKey });
    this.conversationHistory = [];

    this.toolContext = {
      workingDirectory: config.workingDirectory,
      requireApproval: config.permissionMode === 'ask',
    };

    this.state = {
      status: 'idle',
      messages: [],
      tokensUsed: { input: 0, output: 0 },
      turnCount: 0,
      pendingApprovals: [],
    };
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Start a new task
   */
  async run(userMessage: string): Promise<AgentState> {
    if (this.state.status === 'running') {
      throw new Error('Agent is already running');
    }

    this.abortController = new AbortController();
    this.state.currentTask = userMessage;
    this.setStatus('running');

    // Add user message to history
    const userMsg: AgentMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    this.state.messages.push(userMsg);
    this.emit('message', userMsg);

    // Add to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      await this.runConversationLoop();
    } catch (error) {
      if (error instanceof Error && error.message === 'Agent paused') {
        this.setStatus('paused');
      } else {
        this.setStatus('failed');
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    }

    return this.getState();
  }

  /**
   * Resume from paused state (after approvals)
   */
  async resume(): Promise<AgentState> {
    if (this.state.status !== 'paused' && this.state.status !== 'awaiting_approval') {
      throw new Error('Agent is not paused');
    }

    this.abortController = new AbortController();
    this.setStatus('running');

    try {
      await this.runConversationLoop();
    } catch (error) {
      if (error instanceof Error && error.message === 'Agent paused') {
        this.setStatus('paused');
      } else {
        this.setStatus('failed');
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    }

    return this.getState();
  }

  /**
   * Pause the agent
   */
  pause(): void {
    if (this.state.status !== 'running') {
      return;
    }
    this.abortController?.abort();
    this.setStatus('paused');
  }

  /**
   * Approve pending tool calls
   */
  approveToolCalls(toolCallIds: string[]): void {
    for (const id of toolCallIds) {
      const toolCall = this.state.pendingApprovals.find((tc) => tc.id === id);
      if (toolCall) {
        toolCall.status = 'approved';
      }
    }

    // Check if all pending approvals are resolved
    const allResolved = this.state.pendingApprovals.every(
      (tc) => tc.status === 'approved' || tc.status === 'rejected'
    );

    if (allResolved && this.state.status === 'awaiting_approval') {
      // Continue execution
      this.resume();
    }
  }

  /**
   * Reject pending tool calls
   */
  rejectToolCalls(toolCallIds: string[]): void {
    for (const id of toolCallIds) {
      const toolCall = this.state.pendingApprovals.find((tc) => tc.id === id);
      if (toolCall) {
        toolCall.status = 'rejected';
      }
    }

    // Check if all pending approvals are resolved
    const allResolved = this.state.pendingApprovals.every(
      (tc) => tc.status === 'approved' || tc.status === 'rejected'
    );

    if (allResolved && this.state.status === 'awaiting_approval') {
      // Continue execution
      this.resume();
    }
  }

  /**
   * Terminate the agent
   */
  terminate(): void {
    this.abortController?.abort();
    this.setStatus('completed');
    this.emit('complete', this.getState());
  }

  /**
   * Main conversation loop
   */
  private async runConversationLoop(): Promise<void> {
    const tools = this.config.tools || getAllTools();
    const maxTurns = this.config.maxTurns || MAX_TURNS_DEFAULT;

    while (this.state.turnCount < maxTurns) {
      // Check if aborted
      if (this.abortController?.signal.aborted) {
        throw new Error('Agent paused');
      }

      this.state.turnCount++;

      // Get LLM response
      let fullText = '';
      const response = await this.llmClient.streamMessage(
        this.conversationHistory,
        {
          onText: (text) => {
            fullText += text;
            this.emit('text', text);
          },
          onToolUse: (toolUse) => {
            const toolCall: ToolCall = {
              id: toolUse.id,
              name: toolUse.name,
              input: toolUse.input as Record<string, unknown>,
              status: 'pending',
            };
            this.emit('tool_call', toolCall);
          },
        },
        {
          systemPrompt: this.config.systemPrompt,
          tools,
        }
      );

      // Update token usage
      this.state.tokensUsed.input += response.usage.inputTokens;
      this.state.tokensUsed.output += response.usage.outputTokens;

      // Add assistant message to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });

      // Process tool uses
      if (response.toolUses.length > 0) {
        const toolCalls: ToolCall[] = response.toolUses.map((tu) => ({
          id: tu.id,
          name: tu.name,
          input: tu.input as Record<string, unknown>,
          status: 'pending' as const,
        }));

        // Check if approval is needed
        if (this.needsApproval(toolCalls)) {
          this.state.pendingApprovals = toolCalls;
          this.setStatus('awaiting_approval');
          this.emit('approval_required', toolCalls);
          throw new Error('Agent paused');
        }

        // Execute tools
        const toolResults = await this.executeToolCalls(toolCalls);

        // Create assistant message with tool calls
        const assistantMsg: AgentMessage = {
          role: 'assistant',
          content: response.textContent,
          timestamp: new Date().toISOString(),
          toolCalls,
          toolResults,
        };
        this.state.messages.push(assistantMsg);
        this.emit('message', assistantMsg);

        // Continue conversation with tool results
        const toolResultsForLLM: ToolResult[] = toolResults.map((tr) => ({
          tool_use_id: tr.toolCallId,
          content: tr.output,
          is_error: tr.isError,
        }));

        this.conversationHistory.push({
          role: 'user',
          content: toolResultsForLLM.map((r) => ({
            type: 'tool_result' as const,
            tool_use_id: r.tool_use_id,
            content: r.content,
            is_error: r.is_error,
          })),
        });
      } else {
        // No tool calls - conversation turn complete
        const assistantMsg: AgentMessage = {
          role: 'assistant',
          content: response.textContent,
          timestamp: new Date().toISOString(),
        };
        this.state.messages.push(assistantMsg);
        this.emit('message', assistantMsg);

        // Check if task is complete
        if (response.stopReason === 'end_turn') {
          this.setStatus('completed');
          this.emit('complete', this.getState());
          return;
        }
      }

      this.emit('turn_complete', this.state.turnCount);
    }

    // Max turns reached
    this.setStatus('completed');
    this.emit('complete', this.getState());
  }

  /**
   * Check if any tool calls need approval
   */
  private needsApproval(toolCalls: ToolCall[]): boolean {
    if (this.config.permissionMode === 'auto') {
      return false;
    }

    if (this.config.permissionMode === 'ask') {
      // All write operations need approval
      const writeTools = ['write_file', 'run_command'];
      return toolCalls.some((tc) => writeTools.includes(tc.name));
    }

    // Explore mode - only file reads allowed
    if (this.config.permissionMode === 'explore') {
      const readOnlyTools = ['read_file', 'list_directory', 'search_files', 'git_status', 'git_diff'];
      return toolCalls.some((tc) => !readOnlyTools.includes(tc.name));
    }

    return false;
  }

  /**
   * Execute tool calls and return results
   */
  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];

    for (const toolCall of toolCalls) {
      // Skip rejected tool calls
      if (toolCall.status === 'rejected') {
        results.push({
          toolCallId: toolCall.id,
          output: 'Tool call was rejected by user',
          isError: true,
        });
        this.emit('tool_result', results[results.length - 1]);
        continue;
      }

      try {
        const output = await executeTool(
          toolCall.name,
          toolCall.input,
          this.toolContext
        );

        toolCall.status = 'completed';
        const result: ToolCallResult = {
          toolCallId: toolCall.id,
          output,
          isError: false,
        };
        results.push(result);
        this.emit('tool_result', result);
      } catch (error) {
        toolCall.status = 'failed';
        const result: ToolCallResult = {
          toolCallId: toolCall.id,
          output: error instanceof Error ? error.message : String(error),
          isError: true,
        };
        results.push(result);
        this.emit('tool_result', result);
      }
    }

    return results;
  }

  /**
   * Update status and emit event
   */
  private setStatus(status: AgentStatus): void {
    this.state.status = status;
    this.emit('status', status);
  }
}

// =============================================================================
// Agent Factory
// =============================================================================

export interface CreateAgentOptions {
  name: string;
  workingDirectory: string;
  permissionMode?: 'explore' | 'ask' | 'auto';
  systemPrompt?: string;
  maxTurns?: number;
}

/**
 * Create a new agent instance
 */
export function createAgent(options: CreateAgentOptions, apiKey: string): AgentRuntime {
  const config: AgentConfig = {
    id: crypto.randomUUID(),
    name: options.name,
    systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    workingDirectory: options.workingDirectory,
    permissionMode: options.permissionMode || 'ask',
    maxTurns: options.maxTurns,
  };

  return new AgentRuntime(config, apiKey);
}
