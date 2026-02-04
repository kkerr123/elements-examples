import { Search, Plus } from 'lucide-react';

export function TitleBar() {
  return (
    <div className="h-12 flex items-center px-4 border-b border-border drag-region">
      {/* Space for macOS traffic lights */}
      <div className="w-20" />

      {/* Search */}
      <div className="flex-1 flex justify-center no-drag">
        <div className="w-96 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search agents, sessions, or commands..."
            className="w-full h-8 pl-9 pr-4 bg-secondary/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-2xs bg-muted rounded text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* New Agent button */}
      <div className="w-20 flex justify-end no-drag">
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          <span>New</span>
        </button>
      </div>
    </div>
  );
}
