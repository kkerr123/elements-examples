import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  AtSign,
  GitBranch,
  FileCode,
  Clock,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  Circle,
  ChevronRight,
  AlertCircle,
  Check,
  X,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentStore, type AgentMessage, type ToolCall } from '@/stores/agent-store';
import { agentApi } from '@/lib/ipc';

export function WorkspacePanel() {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedAgentId = useAgentStore((state) => state.selectedAgentId);
  const agent = useAgentStore((state) =>
    state.selectedAgentId ? state.agents.get(state.selectedAgentId) : undefined
  );
  const streamingText = agent?.streamingText || '';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agent?.messages, streamingText]);

  const handleSendMessage = async () => {
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (selectedAgentId && agent) {
        // Send message to existing agent
        await agentApi.sendMessage(selectedAgentId, message);
      } else {
        // Spawn a new agent with this task
        const result = await agentApi.spawn({
          name: 'Assistant',
          task: message,
          permissionMode: 'ask',
        });

        // Select the new agent
        useAgentStore.getState().addAgent({
          id: result.id,
          name: result.name,
          status: 'running',
          currentTask: message,
          workingDirectory: result.workingDirectory,
          messages: [],
          pendingApprovals: [],
          streamingText: '',
          turnCount: 0,
          tokensUsed: { input: 0, output: 0 },
        });
        useAgentStore.getState().selectAgent(result.id);
      }
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async () => {
    if (!selectedAgentId) return;
    try {
      await agentApi.pause(selectedAgentId);
    } catch (error) {
      console.error('Failed to pause agent:', error);
    }
  };

  const handleResume = async () => {
    if (!selectedAgentId) return;
    try {
      await agentApi.resume(selectedAgentId);
    } catch (error) {
      console.error('Failed to resume agent:', error);
    }
  };

  const handleTerminate = async () => {
    if (!selectedAgentId) return;
    try {
      await agentApi.terminate(selectedAgentId);
    } catch (error) {
      console.error('Failed to terminate agent:', error);
    }
  };

  const handleApproveAll = async () => {
    if (!selectedAgentId || !agent?.pendingApprovals.length) return;
    try {
      const toolCallIds = agent.pendingApprovals.map((tc) => tc.id);
      await agentApi.approve(selectedAgentId, toolCallIds);
    } catch (error) {
      console.error('Failed to approve tool calls:', error);
    }
  };

  const handleRejectAll = async () => {
    if (!selectedAgentId || !agent?.pendingApprovals.length) return;
    try {
      const toolCallIds = agent.pendingApprovals.map((tc) => tc.id);
      await agentApi.reject(selectedAgentId, toolCallIds);
    } catch (error) {
      console.error('Failed to reject tool calls:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Render empty state when no agent is selected
  if (!agent) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Start a New Task</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Describe what you'd like to accomplish and an agent will help you build it.
            </p>
            <div className="relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Add user authentication with JWT tokens..."
                className="w-full min-h-[100px] p-3 pr-12 bg-secondary/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={4}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || isSubmitting}
                className="absolute bottom-3 right-3 p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    idle: 'text-gray-500',
    running: 'text-green-500',
    paused: 'text-yellow-500',
    awaiting_approval: 'text-orange-500',
    completed: 'text-emerald-500',
    failed: 'text-red-500',
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header with agent controls */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Circle className={cn('w-2 h-2 fill-current', statusColors[agent.status])} />
            <h2 className="font-semibold text-sm">{agent.name}</h2>
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[300px]">
            {agent.currentTask}
          </span>
        </div>

        {/* Agent controls */}
        <div className="flex items-center gap-1">
          {agent.status === 'running' ? (
            <button
              onClick={handlePause}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : agent.status === 'paused' ? (
            <button
              onClick={handleResume}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Resume"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={handleTerminate}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <GitBranch className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Approval banner */}
      {agent.pendingApprovals.length > 0 && (
        <div className="px-4 py-2 bg-orange-500/10 border-b border-orange-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-sm">
              {agent.pendingApprovals.length} tool call{agent.pendingApprovals.length > 1 ? 's' : ''} awaiting approval
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRejectAll}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Reject All
            </button>
            <button
              onClick={handleApproveAll}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <Check className="w-3 h-3" />
              Approve All
            </button>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {agent.messages.map((msg, index) => (
              <MessageBubble key={index} message={msg} />
            ))}

            {/* Streaming text */}
            {streamingText && (
              <div className="flex gap-3">
                <div className="max-w-[80%] rounded-lg p-3 bg-secondary">
                  <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-muted-foreground">Typing...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pending tool calls */}
            {agent.pendingApprovals.map((toolCall) => (
              <ToolCallCard
                key={toolCall.id}
                toolCall={toolCall}
                agentId={selectedAgentId!}
              />
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-border">
            <div className="relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message... (@ for skills, / for commands)"
                className="w-full min-h-[80px] max-h-[200px] p-3 pr-24 bg-secondary/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={3}
                disabled={agent.status === 'running' || agent.status === 'awaiting_approval'}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-1">
                <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <AtSign className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isSubmitting || agent.status === 'running'}
                  className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd>
                <span>to send</span>
              </span>
              <span>·</span>
              <span>Turn {agent.turnCount}</span>
              <span>·</span>
              <span>{agent.tokensUsed.input + agent.tokensUsed.output} tokens</span>
            </div>
          </div>
        </div>

        {/* Right sidebar - Status */}
        <div className="w-48 border-l border-border p-3">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">State</div>
              <div className="text-sm font-medium capitalize">{agent.status.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Turns</div>
              <div className="text-sm font-medium">{agent.turnCount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Tokens</div>
              <div className="text-sm font-medium">
                {agent.tokensUsed.input} in / {agent.tokensUsed.output} out
              </div>
            </div>
            {agent.workingDirectory && (
              <div>
                <div className="text-xs text-muted-foreground">Working Dir</div>
                <div className="text-xs font-mono truncate" title={agent.workingDirectory}>
                  {agent.workingDirectory.split('/').pop()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg p-3',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 space-y-1">
            {message.toolCalls.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center gap-2 text-xs bg-black/20 rounded px-2 py-1"
              >
                <FileCode className="w-3 h-3" />
                <span className="flex-1 font-mono">{tool.name}</span>
                {tool.status === 'completed' && (
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                )}
                {tool.status === 'pending' && (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {tool.status === 'failed' && (
                  <X className="w-3 h-3 text-red-400" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tool results */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="mt-2 text-xs bg-black/10 rounded p-2 max-h-32 overflow-y-auto">
            {message.toolResults.map((result) => (
              <div key={result.toolCallId} className={cn(result.isError && 'text-red-400')}>
                <pre className="font-mono whitespace-pre-wrap">{result.output.slice(0, 500)}</pre>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 text-2xs opacity-60">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

function ToolCallCard({ toolCall, agentId }: { toolCall: ToolCall; agentId: string }) {
  const handleApprove = async () => {
    try {
      await agentApi.approve(agentId, [toolCall.id]);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async () => {
    try {
      await agentApi.reject(agentId, [toolCall.id]);
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  return (
    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-medium">Approval Required</span>
      </div>
      <div className="bg-background/50 rounded p-2 mb-3">
        <div className="text-xs text-muted-foreground mb-1">Tool: {toolCall.name}</div>
        <pre className="text-xs font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
          {JSON.stringify(toolCall.input, null, 2)}
        </pre>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleReject}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-secondary transition-colors"
        >
          <X className="w-3 h-3" />
          Reject
        </button>
        <button
          onClick={handleApprove}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          <Check className="w-3 h-3" />
          Approve
        </button>
      </div>
    </div>
  );
}
