import {
  FolderGit2,
  Bot,
  Sparkles,
  Plug,
  Settings,
  ChevronDown,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data for demo
const mockAgents = [
  { id: '1', name: 'Feature Builder', status: 'running' as const, task: 'Add auth system' },
  { id: '2', name: 'API Designer', status: 'running' as const, task: 'Create endpoints' },
  { id: '3', name: 'Test Writer', status: 'queued' as const, task: 'Write unit tests' },
];

const statusColors = {
  queued: 'text-gray-500',
  running: 'text-green-500',
  paused: 'text-yellow-500',
  blocked: 'text-orange-500',
  needs_review: 'text-purple-500',
  done: 'text-emerald-500',
  failed: 'text-red-500',
};

export function Sidebar() {
  return (
    <div className="w-56 flex flex-col border-r border-border bg-card/50">
      {/* Project Selector */}
      <div className="p-3 border-b border-border">
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors">
          <FolderGit2 className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1 text-left text-sm font-medium truncate">my-project</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Fleet Section */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Fleet
            </span>
            <span className="text-xs text-muted-foreground">
              {mockAgents.filter(a => a.status === 'running').length}/5 active
            </span>
          </div>

          <div className="space-y-1">
            {mockAgents.map((agent) => (
              <button
                key={agent.id}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors text-left group"
              >
                <Circle
                  className={cn(
                    'w-2 h-2 fill-current',
                    statusColors[agent.status]
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{agent.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{agent.task}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-3" />

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          <NavItem icon={Bot} label="All Agents" count={3} active />
          <NavItem icon={Sparkles} label="Skills" count={5} />
          <NavItem icon={Plug} label="Sources" count={2} />
        </nav>
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-border">
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  count,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left text-sm">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );
}
