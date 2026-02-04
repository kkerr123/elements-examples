import { Sidebar } from './components/layout/Sidebar';
import { SessionList } from './components/layout/SessionList';
import { WorkspacePanel } from './components/layout/WorkspacePanel';
import { TitleBar } from './components/layout/TitleBar';
import { useAgentEvents } from './hooks/use-agent-events';

export function App() {
  // Subscribe to agent events from main process
  useAgentEvents();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* macOS-style title bar with traffic lights space */}
      <TitleBar />

      {/* Main three-pane layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Fleet Navigation */}
        <Sidebar />

        {/* Middle: Session/Agent List */}
        <SessionList />

        {/* Right: Agent Workspace */}
        <WorkspacePanel />
      </div>
    </div>
  );
}
