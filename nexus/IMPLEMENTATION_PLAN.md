# Nexus Implementation Plan

## Current State: Visual Prototype
- Three-pane layout with mock data
- Theme switching (light/dark/system)
- Electron app shell running

## Target State: Functional MVP
A working agent orchestration platform where users can:
1. Open a project (git repo)
2. Spawn multiple agents with isolated worktrees
3. Have real conversations with agents that can edit files
4. See live progress and diffs
5. Create/restore checkpoints
6. Merge agent work back to main branch

---

## Phase 1: Core Infrastructure (Foundation)

### 1.1 Project Management
**Goal**: Open a git repo and display its state

- [ ] File picker dialog to select project folder
- [ ] Validate it's a git repository
- [ ] Read git status, branch info, recent commits
- [ ] Store recent projects list
- [ ] Display project name and path in sidebar

**Files to create/modify**:
- `packages/core/src/git/repository.ts` - Git operations wrapper
- `packages/core/src/project/manager.ts` - Project lifecycle
- `main/handlers/project.ts` - IPC handlers for project ops

### 1.2 Session Persistence
**Goal**: Save and load conversation history

- [ ] Define JSONL format for session storage
- [ ] Create sessions directory per project (`.nexus/sessions/`)
- [ ] Auto-save on each message
- [ ] Load sessions on project open
- [ ] Session metadata (title, status, timestamps)

**Files to create**:
- `packages/core/src/session/storage.ts` - JSONL read/write
- `packages/core/src/session/manager.ts` - Session lifecycle

### 1.3 Settings & Configuration
**Goal**: Persist user preferences and API keys

- [ ] Settings file location (`~/.nexus/config.json`)
- [ ] API key storage (encrypted)
- [ ] Default preferences (theme, max agents, etc.)
- [ ] Settings UI panel

**Files to create**:
- `packages/core/src/config/settings.ts` - Settings manager
- `packages/core/src/config/credentials.ts` - Secure key storage

---

## Phase 2: Agent Runtime (Core Feature)

### 2.1 LLM Integration
**Goal**: Connect to Claude API and stream responses

- [ ] Anthropic SDK integration
- [ ] Streaming response handling
- [ ] Token counting and rate limiting
- [ ] Error handling and retries
- [ ] Model selection (claude-3-5-sonnet, etc.)

**Files to create**:
- `packages/core/src/llm/client.ts` - Anthropic client wrapper
- `packages/core/src/llm/streaming.ts` - Stream handling

### 2.2 Tool System
**Goal**: Enable agents to read/write files and run commands

Built-in tools:
- [ ] `read_file` - Read file contents
- [ ] `write_file` - Write/create files
- [ ] `list_directory` - List files in directory
- [ ] `search_files` - Grep/ripgrep integration
- [ ] `run_command` - Execute shell commands (with approval)
- [ ] `git_status` - Get current git state
- [ ] `git_diff` - Show file diffs

**Files to create**:
- `packages/core/src/tools/index.ts` - Tool registry
- `packages/core/src/tools/filesystem.ts` - File operations
- `packages/core/src/tools/git.ts` - Git operations
- `packages/core/src/tools/shell.ts` - Command execution

### 2.3 Agent Orchestrator
**Goal**: Manage agent lifecycle and message flow

- [ ] Agent spawn with configuration
- [ ] Message loop (user → agent → tools → agent → user)
- [ ] Pause/resume/terminate controls
- [ ] Status tracking and events
- [ ] Concurrency limiting (max 5 agents)

**Files to create**:
- `packages/core/src/agent/runtime.ts` - Single agent runtime
- `packages/core/src/agent/orchestrator.ts` - Multi-agent coordinator
- `packages/core/src/agent/queue.ts` - Agent queue management

---

## Phase 3: Environment Isolation (Key Differentiator)

### 3.1 Git Worktree Management
**Goal**: Each agent gets isolated filesystem via git worktree

- [ ] Create worktree from base branch
- [ ] Track worktree → agent mapping
- [ ] Clean up worktrees on agent termination
- [ ] Handle worktree conflicts

**Files to create**:
- `packages/core/src/git/worktree.ts` - Worktree operations

### 3.2 Agent Sandboxing
**Goal**: Scope agent file operations to its worktree

- [ ] Path resolution within worktree
- [ ] Prevent access outside worktree
- [ ] Tool execution in worktree context

**Files to modify**:
- `packages/core/src/tools/filesystem.ts` - Add worktree scoping

---

## Phase 4: Checkpoint System

### 4.1 Checkpoint Creation
**Goal**: Snapshot agent state at any point

- [ ] Git commit for file state
- [ ] Conversation state snapshot
- [ ] Checkpoint metadata (trigger, description)
- [ ] Auto-checkpoint on file writes

**Files to create**:
- `packages/core/src/checkpoint/manager.ts` - Checkpoint lifecycle
- `packages/core/src/checkpoint/storage.ts` - Checkpoint persistence

### 4.2 Checkpoint Restore
**Goal**: Roll back agent to previous state

- [ ] Git reset to checkpoint commit
- [ ] Restore conversation state
- [ ] UI confirmation dialog
- [ ] Handle in-progress operations

---

## Phase 5: Real-Time UI Updates

### 5.1 Event System
**Goal**: Stream updates from backend to UI

- [ ] WebSocket or IPC event channel
- [ ] Event types (message, tool_call, status_change, diff)
- [ ] Reconnection handling

**Files to create**:
- `packages/core/src/events/emitter.ts` - Event bus
- `main/events.ts` - IPC event forwarding

### 5.2 Live Diff Viewer
**Goal**: Show file changes as they happen

- [ ] Diff calculation (before/after)
- [ ] Syntax highlighting
- [ ] Multi-file diff view
- [ ] Accept/reject changes

**Files to create**:
- `renderer/src/components/diff/DiffViewer.tsx`
- `renderer/src/components/diff/FileDiff.tsx`

### 5.3 Tool Call Visualization
**Goal**: Show what tools agent is using

- [ ] Tool call timeline
- [ ] Expandable input/output
- [ ] Status indicators (pending, running, success, error)

---

## Phase 6: Merge Orchestration

### 6.1 Overlap Detection
**Goal**: Identify when agents touch same files

- [ ] Track modified files per agent
- [ ] Detect file-level overlaps
- [ ] Detect function-level overlaps (via AST or heuristics)
- [ ] UI warning indicators

### 6.2 Merge Workflow
**Goal**: Combine agent work back to main branch

- [ ] Sequential merge strategy
- [ ] Parallel merge (non-conflicting)
- [ ] Interactive conflict resolution
- [ ] Merge preview before execution

---

## Phase 7: Polish & UX

### 7.1 Keyboard Shortcuts
- `Cmd+N` - New agent
- `Cmd+K` - Command palette
- `Cmd+1/2/3` - Focus panes
- `Shift+Tab` - Cycle permission modes

### 7.2 Notifications
- Agent completion
- Conflicts detected
- Errors

### 7.3 Onboarding
- First-run setup wizard
- API key configuration
- Sample project

---

## Implementation Order (Recommended)

```
Week 1: Phase 1 (Infrastructure)
├── 1.1 Project Management
├── 1.2 Session Persistence
└── 1.3 Settings & Config

Week 2: Phase 2 (Agent Runtime)
├── 2.1 LLM Integration
├── 2.2 Tool System
└── 2.3 Agent Orchestrator

Week 3: Phase 3 + 4 (Isolation & Checkpoints)
├── 3.1 Git Worktree Management
├── 3.2 Agent Sandboxing
├── 4.1 Checkpoint Creation
└── 4.2 Checkpoint Restore

Week 4: Phase 5 + 6 (Real-time & Merge)
├── 5.1 Event System
├── 5.2 Live Diff Viewer
├── 5.3 Tool Call Visualization
├── 6.1 Overlap Detection
└── 6.2 Merge Workflow

Week 5: Phase 7 (Polish)
└── All polish items
```

---

## Next Immediate Steps

1. **Create `packages/core` package** with proper structure
2. **Implement Project Management** (1.1) - most visible progress
3. **Add API key settings** (1.3) - required for LLM
4. **Implement basic LLM chat** (2.1) - prove the core loop works

Let's start with Phase 1.1 - Project Management.
