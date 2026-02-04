import { Circle, Flag, MoreHorizontal, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock sessions data
const mockSessions = [
  {
    id: '1',
    agentName: 'Feature Builder',
    title: 'Add user authentication',
    status: 'running' as const,
    lastMessage: 'Creating the login component with JWT handling...',
    updatedAt: new Date(Date.now() - 1000 * 60 * 2), // 2 min ago
    flagged: false,
  },
  {
    id: '2',
    agentName: 'API Designer',
    title: 'Design REST endpoints',
    status: 'running' as const,
    lastMessage: 'Implementing /api/v1/users endpoint with proper validation',
    updatedAt: new Date(Date.now() - 1000 * 60 * 5), // 5 min ago
    flagged: true,
  },
  {
    id: '3',
    agentName: 'Test Writer',
    title: 'Write unit tests for auth',
    status: 'queued' as const,
    lastMessage: 'Waiting for Feature Builder to complete auth module...',
    updatedAt: new Date(Date.now() - 1000 * 60 * 10), // 10 min ago
    flagged: false,
  },
  {
    id: '4',
    agentName: 'Bug Hunter',
    title: 'Fix memory leak in dashboard',
    status: 'done' as const,
    lastMessage: 'Fixed! The issue was an unsubscribed event listener in useEffect.',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    flagged: false,
  },
];

const statusConfig = {
  queued: { color: 'bg-gray-500', label: 'Queued' },
  running: { color: 'bg-green-500', pulse: true, label: 'Running' },
  paused: { color: 'bg-yellow-500', label: 'Paused' },
  blocked: { color: 'bg-orange-500', label: 'Blocked' },
  needs_review: { color: 'bg-purple-500', label: 'Review' },
  done: { color: 'bg-emerald-500', label: 'Done' },
  failed: { color: 'bg-red-500', label: 'Failed' },
};

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString();
}

export function SessionList() {
  return (
    <div className="w-80 flex flex-col border-r border-border bg-card/30">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border">
        <h2 className="font-semibold text-sm">Sessions</h2>
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <Archive className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        <div className="p-2 space-y-1">
          {mockSessions.map((session, index) => (
            <SessionCard
              key={session.id}
              session={session}
              selected={index === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  selected,
}: {
  session: typeof mockSessions[0];
  selected?: boolean;
}) {
  const status = statusConfig[session.status];

  return (
    <button
      className={cn(
        'w-full text-left p-3 rounded-lg transition-colors',
        selected ? 'bg-secondary' : 'hover:bg-secondary/50'
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1">
        <div className="relative">
          <Circle
            className={cn('w-2 h-2 fill-current', status.color.replace('bg-', 'text-'))}
          />
          {status.pulse && (
            <Circle
              className={cn(
                'w-2 h-2 fill-current absolute inset-0 animate-ping',
                status.color.replace('bg-', 'text-')
              )}
            />
          )}
        </div>
        <span className="text-xs text-muted-foreground">{session.agentName}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{formatTime(session.updatedAt)}</span>
        {session.flagged && (
          <Flag className="w-3 h-3 text-yellow-500 fill-yellow-500 ml-auto" />
        )}
      </div>

      {/* Title */}
      <h3 className="font-medium text-sm mb-1 truncate">{session.title}</h3>

      {/* Last message preview */}
      <p className="text-xs text-muted-foreground line-clamp-2">
        {session.lastMessage}
      </p>

      {/* Status badge */}
      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-2xs font-medium',
            status.color,
            'text-white'
          )}
        >
          {status.label}
        </span>
      </div>
    </button>
  );
}
