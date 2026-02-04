import { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock conversation data
const mockMessages = [
  {
    id: '1',
    role: 'user' as const,
    content: 'Add user authentication with JWT tokens. Use bcrypt for password hashing.',
    timestamp: new Date(Date.now() - 1000 * 60 * 10),
  },
  {
    id: '2',
    role: 'assistant' as const,
    content: "I'll implement JWT authentication with bcrypt password hashing. Let me start by creating the necessary files and dependencies.",
    timestamp: new Date(Date.now() - 1000 * 60 * 9),
    toolCalls: [
      { name: 'read_file', status: 'success' as const, file: 'package.json' },
      { name: 'write_file', status: 'success' as const, file: 'src/auth/jwt.ts' },
      { name: 'write_file', status: 'running' as const, file: 'src/auth/password.ts' },
    ],
  },
];

const mockCheckpoints = [
  { id: '1', label: 'Start', time: '10m ago' },
  { id: '2', label: 'Added JWT utils', time: '8m ago' },
  { id: '3', label: 'Password hashing', time: '5m ago', current: true },
];

export function WorkspacePanel() {
  const [message, setMessage] = useState('');

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header with agent controls */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-green-500 text-green-500" />
            <h2 className="font-semibold text-sm">Feature Builder</h2>
          </div>
          <span className="text-xs text-muted-foreground">Add user authentication</span>
        </div>

        {/* Agent controls */}
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Pause className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
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

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mockMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-border">
            <div className="relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Send a message... (@ for skills, / for commands)"
                className="w-full min-h-[80px] max-h-[200px] p-3 pr-24 bg-secondary/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={3}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-1">
                <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <AtSign className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded">Shift+Tab</kbd>
                <span>Permission: Ask</span>
              </span>
              <span>·</span>
              <span>3 files changed</span>
            </div>
          </div>
        </div>

        {/* Right sidebar - Checkpoints */}
        <div className="w-48 border-l border-border p-3">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Checkpoints
            </span>
          </div>
          <div className="space-y-2">
            {mockCheckpoints.map((cp) => (
              <button
                key={cp.id}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
                  cp.current
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-secondary/50 text-muted-foreground'
                )}
              >
                {cp.current ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{cp.label}</div>
                  <div className="text-2xs opacity-60">{cp.time}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: typeof mockMessages[0] }) {
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
            {message.toolCalls.map((tool, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs bg-black/20 rounded px-2 py-1"
              >
                <FileCode className="w-3 h-3" />
                <span className="flex-1 font-mono">{tool.file}</span>
                {tool.status === 'success' && (
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                )}
                {tool.status === 'running' && (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 text-2xs opacity-60">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
