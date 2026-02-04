# Agent Orchestration Platform: Product Vision Spec

## Executive Summary

**Codename: Nexus**

A developer-first platform that combines isolated agent development environments with visual orchestration, enabling developers to deploy multiple AI agents—each with their own sandboxed workspace—while maintaining unified visibility and control across all concurrent workflows.

---

## Problem Statement

### Current Pain Points

1. **Single-threaded agent workflows**: Existing AI coding assistants (Cursor, Claude Code, GitHub Copilot) operate in a single session context. Developers cannot parallelize work across multiple agents without manual context-switching between windows/tabs.

2. **No environment isolation**: When agents make changes, they affect a shared codebase state. There's no native concept of "give this agent its own sandbox to experiment in" without manual git branch management.

3. **Limited orchestration visibility**: Developers lack a command-center view showing what multiple agents are doing simultaneously, their progress, and how their work might interact.

4. **Context loss across sessions**: Starting new agent conversations loses accumulated context. There's no persistent "agent memory" scoped to specific task domains.

---

## Product Vision

**Nexus enables developers to orchestrate a fleet of AI agents, each operating in an isolated development environment, with unified visibility into all concurrent workflows and intelligent work merging.**

### Core Value Proposition

> "Parallelize your development velocity by deploying specialized agents to separate concerns—each in their own sandbox—then merge their work when ready."

---

## Target User

**Primary Persona: Senior Full-Stack Developer / Tech Lead**

- Works on complex codebases with multiple subsystems
- Frequently context-switches between features, bug fixes, and reviews
- Values automation but needs control and visibility
- Comfortable with git workflows and environment management

**Secondary Persona: Solo Founder / Indie Developer**

- Wears multiple hats (frontend, backend, infra, docs)
- Limited time; wants to parallelize work they'd otherwise do sequentially
- Needs "set it and forget it" workflows with notification on completion

---

## Key User Flow Loop

### The Parallel Development Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                     THE NEXUS WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   1. DISPATCH                                                        │
│      ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│      │ Agent A  │     │ Agent B  │     │ Agent C  │                │
│      │ Frontend │     │ Backend  │     │ Tests    │                │
│      │ Feature  │     │ API      │     │ Suite    │                │
│      └────┬─────┘     └────┬─────┘     └────┬─────┘                │
│           │                │                │                       │
│   2. ISOLATE (Each agent gets its own environment)                  │
│           ▼                ▼                ▼                       │
│      ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│      │ Sandbox  │     │ Sandbox  │     │ Sandbox  │                │
│      │ Branch A │     │ Branch B │     │ Branch C │                │
│      │ + Devenv │     │ + Devenv │     │ + Devenv │                │
│      └────┬─────┘     └────┬─────┘     └────┬─────┘                │
│           │                │                │                       │
│   3. OBSERVE (Command center visibility)                            │
│           └────────────────┼────────────────┘                       │
│                            ▼                                        │
│                   ┌─────────────────┐                               │
│                   │  Orchestration  │                               │
│                   │     Dashboard   │                               │
│                   │                 │                               │
│                   │ • Live diffs    │                               │
│                   │ • Checkpoints   │                               │
│                   │ • Conflict map  │                               │
│                   └────────┬────────┘                               │
│                            │                                        │
│   4. MERGE (Intelligent work composition)                           │
│                            ▼                                        │
│                   ┌─────────────────┐                               │
│                   │   Unified       │                               │
│                   │   Codebase      │                               │
│                   │   (main branch) │                               │
│                   └─────────────────┘                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### What Makes This Loop Unique

1. **True parallelization**: Unlike existing tools, developers can run 3-5 agents simultaneously on different concerns without conflicts
2. **Environment isolation as a first-class concept**: Each agent operates in its own git worktree, eliminating "stepping on each other's toes"
3. **Orchestration visibility**: A single pane of glass shows all agent activity, enabling the developer to be a "conductor" rather than a "player"
4. **Intelligent merging**: The system understands agent work products and can suggest merge order, flag conflicts early, and auto-resolve non-conflicting changes

---

## Feature Specification

### 1. Agent Fleet Management

#### 1.1 Agent Spawning with Environment Isolation

```typescript
interface AgentSpawnConfig {
  name: string;
  task: string;
  environment: {
    baseRef: string;  // git ref to branch from
    timeout?: number; // max runtime in minutes
  };
  permissions: PermissionMode;
  sources: SourceConfig[];  // MCP servers, APIs, filesystems
  skills: string[];  // workspace-scoped instruction sets
}
```

**Environment Isolation:**

All agents run in **git worktrees** - isolated filesystem copies that share the git object store. This provides:
- Fast startup (~500ms)
- Full filesystem isolation between agents
- Native git tooling compatibility
- Minimal disk overhead (shared objects)

> **Future consideration:** Container isolation may be added later for untrusted operations if user demand warrants the added complexity.

#### 1.2 Agent Templates (Craft-inspired)

Pre-configured agent archetypes that can be customized:

- **Feature Builder**: Full permissions, branched environment, test runner access
- **Refactorer**: Read-heavy, write-gated, large context window
- **Bug Hunter**: Diagnostic tools, log access, minimal write permissions
- **Documenter**: Docs folder scoped, markdown-optimized
- **Reviewer**: Read-only, diff analysis, comment generation

### 2. Orchestration Dashboard (Command Center)

#### 2.1 Three-Pane Layout (Craft-inspired)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌─────────────────────┐  ┌─────────────────────────┐ │
│  │          │  │                     │  │                         │ │
│  │  Fleet   │  │   Session List      │  │   Agent Workspace       │ │
│  │  Nav     │  │                     │  │                         │ │
│  │          │  │   ┌───────────────┐ │  │   ┌─────────────────┐   │ │
│  │ Projects │  │   │ Agent A ●     │ │  │   │ Live Terminal   │   │ │
│  │ ────────│  │   │ "Add auth"    │ │  │   │ & File Changes  │   │ │
│  │ > myapp  │  │   │ In Progress   │ │  │   └─────────────────┘   │ │
│  │   Fleet  │  │   └───────────────┘ │  │                         │ │
│  │   ─────  │  │   ┌───────────────┐ │  │   ┌─────────────────┐   │ │
│  │   A ●    │  │   │ Agent B ●     │ │  │   │ Conversation    │   │ │
│  │   B ●    │  │   │ "API endpts"  │ │  │   │ & Tool Calls    │   │ │
│  │   C ○    │  │   │ Needs Review  │ │  │   └─────────────────┘   │ │
│  │          │  │   └───────────────┘ │  │                         │ │
│  │ Skills   │  │   ┌───────────────┐ │  │   ┌─────────────────┐   │ │
│  │ Sources  │  │   │ Agent C ○     │ │  │   │ Checkpoint      │   │ │
│  │ Settings │  │   │ "Write tests" │ │  │   │ Timeline        │   │ │
│  │          │  │   │ Queued        │ │  │   └─────────────────┘   │ │
│  └──────────┘  └─────────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.2 Status Workflow System (Craft-inspired)

Customizable agent states with visual indicators:

```typescript
type AgentStatus =
  | 'queued'        // ○ Waiting to start
  | 'running'       // ● Active
  | 'paused'        // ◐ User-paused
  | 'blocked'       // ◉ Waiting for approval
  | 'needs_review'  // ◈ Work complete, awaiting review
  | 'done'          // ✓ Completed and merged
  | 'failed';       // ✗ Error state
```

#### 2.3 Real-Time Visualization

- **Live diff stream**: See file changes as agents make them
- **Tool call timeline**: Visualize what tools each agent invokes
- **Overlap detector**: Highlights when multiple agents touch the same files/functions

### 3. Checkpoint & Rollback System (Void-inspired)

#### 3.1 Automatic Checkpointing

```typescript
interface Checkpoint {
  id: string;
  agentId: string;
  timestamp: Date;
  trigger: 'auto' | 'manual' | 'milestone';
  snapshot: {
    gitRef: string;
    workingTreeHash: string;
    conversationState: ConversationSnapshot;
    toolCallHistory: ToolCall[];
  };
  metadata: {
    filesChanged: string[];
    linesAdded: number;
    linesRemoved: number;
    description?: string;  // AI-generated summary
  };
}
```

**Checkpoint Triggers:**
- Every N tool calls (configurable, default: 10)
- Before/after file writes
- User-defined milestones
- Pre-merge verification points

#### 3.2 Visual Timeline

```
Agent A: "Add authentication"
──────────────────────────────────────────────────────────────────▶
    │         │              │                   │           │
    ●─────────●──────────────●───────────────────●───────────●
    │         │              │                   │           │
  Start    Auth       Middleware           Tests        Done
           model       added               pass

  [Restore] [Restore]     [Restore]        [Restore]  [Current]
```

### 4. Permission Model (Craft-inspired)

#### 4.1 Three-Tier Authorization

| Mode | Symbol | Behavior | Use Case |
|------|--------|----------|----------|
| **Explore** | 🔍 | Read-only, no writes | Investigation, learning codebase |
| **Ask** | 🔐 | Approval required per operation | Default for most work |
| **Auto** | ⚡ | Full autonomy within scope | Trusted, well-defined tasks |

#### 4.2 Scope-Based Permissions

```typescript
interface PermissionScope {
  mode: 'explore' | 'ask' | 'auto';
  boundaries: {
    paths: string[];      // Glob patterns: ["src/**", "!src/secrets/**"]
    operations: Operation[]; // ['read', 'write', 'delete', 'execute']
    tools: string[];      // Allowed MCP tools
    external: {
      network: boolean;
      apis: string[];     // Allowed API domains
    };
  };
}
```

### 5. Source & Skill System (Craft-inspired)

#### 5.1 Sources (External Integrations)

```typescript
interface Source {
  type: 'mcp' | 'rest' | 'filesystem' | 'database';
  config: SourceConfig;
  credentials: EncryptedCredentials;  // AES-256-GCM
  permissions: PermissionScope;
}
```

**Built-in Source Types:**
- MCP Servers (local subprocess spawning with env filtering)
- REST APIs with OAuth flow (GitHub, Linear, Slack, etc.)
- Database connections (read-only by default)
- Cloud providers (AWS, GCP, Azure via SDKs)

#### 5.2 Skills (Workspace-Scoped Instructions)

```typescript
interface Skill {
  name: string;
  description: string;
  instructions: string;      // System prompt addition
  requiredSources: string[]; // Sources this skill needs
  exampleInvocations: string[];
}
```

**Invocation:** `@skill-name` in conversation (like Craft)

**Example Skills:**
- `@pr-reviewer`: "Analyze this PR for security issues, performance concerns, and style violations"
- `@api-designer`: "Design REST endpoints following our OpenAPI conventions in /docs/api-standards.md"
- `@migration-writer`: "Generate database migrations using our Prisma schema conventions"

### 6. Shared Context Store

A critical feature for multi-agent orchestration: agents working on the same project should accumulate shared understanding.

#### 6.1 Project Knowledge Base

```typescript
interface SharedContext {
  projectId: string;
  entries: ContextEntry[];
}

interface ContextEntry {
  id: string;
  type: 'discovery' | 'decision' | 'convention' | 'warning';
  content: string;
  source: {
    agentId: string;
    timestamp: Date;
    sessionId: string;
  };
  references: string[];  // file paths, URLs, etc.
}
```

**Example entries:**
- `discovery`: "Auth tokens are stored in Redis with prefix `auth:session:`"
- `decision`: "We chose Prisma over TypeORM for the ORM"
- `convention`: "API routes follow pattern `/api/v1/{resource}/{id}`"
- `warning`: "The legacy payment module has undocumented side effects"

#### 6.2 Context Flow

```
Agent A discovers: "Auth uses JWT stored in Redis"
                    │
                    ▼
            ┌───────────────┐
            │ Shared Context│
            │     Store     │
            └───────┬───────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    Agent B     Agent C     Agent D
    (reads)     (reads)     (reads)
```

Agents automatically read shared context at spawn and can contribute discoveries during their work. This prevents the "Agent B doesn't know what Agent A learned" problem.

---

### 7. Merge Orchestration

#### 7.1 Overlap Detection

Pre-merge analysis that identifies file and function-level overlaps:

| Detection Type | Reliability | Description |
|----------------|-------------|-------------|
| **File overlap** | High | Multiple agents modified same file |
| **Function overlap** | High | Multiple agents modified same function |
| **Dependency mismatch** | High | Conflicting package.json / lockfile changes |

> **Scope limitation:** Semantic conflicts ("related code") are not reliably detectable. The system focuses on what can be accurately identified rather than promising magic.

#### 7.2 Merge Strategies

```typescript
type MergeStrategy =
  | 'sequential'    // Merge one agent at a time in order
  | 'parallel'      // Merge non-conflicting changes simultaneously
  | 'interactive';  // User resolves each conflict
```

> **Note:** AI can explain conflicts and suggest merge order, but actual conflict resolution requires precise text manipulation that should remain user-controlled.

#### 7.3 Merge Visualization

```
                        main
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
  Agent A              Agent B              Agent C
  (auth)                (api)               (tests)
    │                     │                     │
    │                     │                     │
    ▼                     ▼                     ▼
  +auth/                +api/               +tests/
  +middleware/          +routes/            modified:
  modified:             modified:            - auth/*
   - app.ts              - app.ts            - api/*

    │                     │                     │
    │    ⚠️ CONFLICT      │                     │
    │    app.ts:45-52     │                     │
    └──────────┬──────────┘                     │
               │                                │
               ▼                                │
         [Resolve]                              │
               │                                │
               └────────────────┬───────────────┘
                                │
                                ▼
                        main (merged)
```

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NEXUS ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Presentation Layer                        │    │
│  │                    ┌─────────────┐                           │    │
│  │                    │   Electron  │                           │    │
│  │                    │   Desktop   │                           │    │
│  │                    └──────┬──────┘                           │    │
│  │                           ▼                                  │    │
│  │              React + shadcn/ui + Tailwind                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Orchestration Layer                        │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  │    │
│  │  │    Fleet      │  │   Session     │  │    Merge        │  │    │
│  │  │   Manager     │  │   Manager     │  │   Coordinator   │  │    │
│  │  └───────────────┘  └───────────────┘  └─────────────────┘  │    │
│  │          │                  │                   │            │    │
│  │          └──────────────────┼───────────────────┘            │    │
│  │                             ▼                                │    │
│  │                   Event Bus (WebSocket)                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Agent Runtime Layer                      │    │
│  │  ┌───────────────────────────────────────────────────────┐  │    │
│  │  │              Agent Sandbox Pool                        │  │    │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │  │    │
│  │  │  │ Agent 1 │  │ Agent 2 │  │ Agent 3 │  │ Agent N │  │  │    │
│  │  │  │┌───────┐│  │┌───────┐│  │┌───────┐│  │┌───────┐│  │  │    │
│  │  │  ││ LLM   ││  ││ LLM   ││  ││ LLM   ││  ││ LLM   ││  │  │    │
│  │  │  │├───────┤│  │├───────┤│  │├───────┤│  │├───────┤│  │  │    │
│  │  │  ││ Tools ││  ││ Tools ││  ││ Tools ││  ││ Tools ││  │  │    │
│  │  │  │├───────┤│  │├───────┤│  │├───────┤│  │├───────┤│  │  │    │
│  │  │  ││Sandbox││  ││Sandbox││  ││Sandbox││  ││Sandbox││  │  │    │
│  │  │  │└───────┘│  │└───────┘│  │└───────┘│  │└───────┘│  │  │    │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Environment Layer                         │    │
│  │         ┌───────────────────────────────────────┐            │    │
│  │         │         Git Worktree Manager          │            │    │
│  │         └───────────────────────────────────────┘            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Persistence Layer                         │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  │    │
│  │  │   Sessions    │  │  Checkpoints  │  │   Credentials   │  │    │
│  │  │   (JSONL)     │  │    (Git)      │  │  (AES-256-GCM)  │  │    │
│  │  └───────────────┘  └───────────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Package Structure (Monorepo)

```
nexus/
├── apps/
│   └── desktop/          # Electron app
│       ├── main/         # Main process (esbuild)
│       └── renderer/     # React UI (Vite)
├── packages/
│   ├── core/             # Agent runtime, LLM clients
│   ├── orchestrator/     # Fleet management, scheduling
│   ├── sandbox/          # Environment isolation (worktree, container)
│   ├── checkpoint/       # Snapshot & restore system
│   ├── merge/            # Conflict detection & resolution
│   ├── sources/          # MCP, REST, filesystem connectors
│   ├── shared/           # Types, utilities, constants
│   └── ui/               # shadcn components, design system
├── tools/
│   ├── mcp-servers/      # Built-in MCP server implementations
│   └── cli/              # Command-line interface
└── docs/
    ├── architecture/
    └── api/
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **UI Framework** | React 18+ | Industry standard, excellent tooling |
| **UI Components** | shadcn/ui + Radix | Accessible, customizable, Craft-proven |
| **Styling** | Tailwind CSS v4 | Utility-first, fast iteration |
| **Desktop** | Electron | Cross-platform, VS Code heritage |
| **Build (Main)** | esbuild | Fast, simple, Craft-proven |
| **Build (Renderer)** | Vite | HMR, modern bundling |
| **State** | Zustand | Lightweight, TypeScript-native |
| **Agent SDK** | Anthropic Agent SDK | First-party Claude integration |
| **Git Integration** | isomorphic-git + native | Worktree support, cross-platform |
| **IPC** | Electron IPC + WebSocket | Real-time updates |
| **Persistence** | JSONL (sessions) + SQLite (metadata) | Simple, portable |

---

## Performance Considerations

### 1. Agent Concurrency

```typescript
const MAX_CONCURRENT_AGENTS = 5;  // Simple limit, no complex scheduling
```

Agents beyond the limit are queued (FIFO). If an agent fails due to system resources, the user is notified. No complex scheduling needed for typical dev machines running 3-5 concurrent agents.

### 2. Environment Isolation Performance

| Metric | Value |
|--------|-------|
| Worktree startup | ~500ms |
| Memory overhead | ~50MB per agent (git index) |
| Disk usage | Shared git objects, minimal duplication |

**Optimization Strategies:**
- Use sparse checkouts for large repos
- Implement copy-on-write for worktrees where supported

### 3. LLM Request Management

```typescript
interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'local';
  rateLimiting: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    strategy: 'queue' | 'drop' | 'throttle';
  };
  caching: {
    enabled: boolean;
    ttlSeconds: number;
    maxSizeBytes: number;
  };
  streaming: boolean;  // Always true for UX
}
```

### 4. Checkpoint Storage

- **Git refs**: Code state stored as git refs (git handles compression)
- **Conversation state**: Gzip-compressed JSON
- **Lazy loading**: Only hydrate checkpoint data on restore
- **Pruning**: Auto-delete old checkpoints based on retention policy (default: 7 days)

---

## Extensibility

### 1. MCP Server Support

Native support for Model Context Protocol servers:
- Built-in server management (start, stop, restart)
- Environment variable filtering (security)
- Health checking and auto-restart
- Custom tool schemas with `_intent` fields for smart summarization

### 2. Custom Agent Templates

```yaml
# .nexus/templates/my-custom-agent.yaml
name: my-custom-agent
displayName: "Custom Feature Builder"
description: "Builds features following our team conventions"

environment:
  type: worktree
  resources:
    memory: 4GB
    timeout: 30

permissions:
  mode: ask
  paths:
    - "src/**"
    - "!src/legacy/**"
  operations:
    - read
    - write

sources:
  - name: github
    permissions: read
  - name: linear
    permissions: read

skills:
  - "@code-standards"
  - "@test-conventions"

systemPrompt: |
  You are a feature builder for our team.
  Always follow the conventions in /docs/CONTRIBUTING.md.
  Write tests for all new code.
```

### 3. Deep Linking Protocol

```
nexus://spawn?template=feature-builder&task=Add%20user%20auth
nexus://session/{sessionId}
nexus://checkpoint/{checkpointId}/restore
```

---

## Security Model

### 1. Credential Management

- All credentials encrypted with AES-256-GCM
- Stored separately from configuration
- Never logged or included in checkpoints
- Per-workspace credential scoping

### 2. Environment Isolation

- Git worktrees have no access to host credentials by default
- MCP server subprocesses filter sensitive env vars
- Network access is opt-in per agent
- Each agent's worktree is isolated from others

### 3. Audit Trail

```typescript
interface AuditEvent {
  timestamp: Date;
  agentId: string;
  action: string;
  details: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'blocked';
  blockedReason?: string;
}
```

All agent actions are logged for review.

---

## Success Metrics

### Primary KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Parallel Velocity** | 3x throughput vs single-agent | Tasks completed per hour |
| **Merge Success Rate** | >90% auto-merge | Merges without manual intervention |
| **Checkpoint Restore Time** | <5 seconds | Time to restore any checkpoint |
| **Agent Spawn Time** | <3 seconds (worktree) | Time from dispatch to first action |

### User Satisfaction

- **NPS Score**: Target 50+
- **Weekly Active Users**: Track growth
- **Session Duration**: Longer = more engaged
- **Agents per Session**: Target 3+ average

---

## Roadmap

### Phase 1: Foundation (MVP)

- [ ] Core agent runtime with git worktree isolation
- [ ] Basic orchestration dashboard (3-pane layout)
- [ ] Permission system (explore/ask/auto)
- [ ] Checkpoint system (auto + manual)
- [ ] Session persistence (JSONL)
- [ ] Shared context store (basic read/write)

### Phase 2: Orchestration

- [ ] Fleet management (spawn, pause, resume, terminate)
- [ ] Status workflow system
- [ ] Real-time visualization (diffs, tool calls, overlap detection)
- [ ] Merge coordinator with file/function overlap detection
- [ ] Source system with agent-driven configuration (MCP, REST)
- [ ] Skill system with `@` invocation
- [ ] Agent templates (Feature Builder, Refactorer, Bug Hunter, Documenter, Reviewer)

### Phase 3: Scale

- [ ] Container isolation option (if user demand warrants)
- [ ] VS Code extension (if user demand warrants)
- [ ] Team collaboration features
- [ ] Plugin system (based on observed extension patterns)
- [ ] Cloud sync (optional)

### Phase 4: Intelligence

- [ ] Agent performance analytics
- [ ] Smart task decomposition
- [ ] Enhanced shared context with automatic discovery

---

## Appendix A: Competitive Analysis

| Feature | Cursor | Claude Code | Craft Agents | **Nexus** |
|---------|--------|-------------|--------------|-----------|
| Multi-agent | ✗ | ✗ | Limited | ✓ |
| Environment isolation | ✗ | ✗ | ✗ | ✓ |
| Visual orchestration | ✗ | ✗ | ✓ | ✓ |
| Checkpoint system | Partial | ✗ | ✗ | ✓ |
| Permission gating | ✗ | ✓ | ✓ | ✓ |
| MCP support | ✗ | ✓ | ✓ | ✓ |
| Merge coordination | ✗ | ✗ | ✗ | ✓ |
| Model flexibility | Limited | ✓ | ✓ | ✓ |
| Open source | ✗ | ✗ | ✓ | ✓ |

---

## Appendix B: User Stories

### Story 1: Parallel Feature Development

> As a **senior developer**, I want to **spawn three agents to work on frontend, backend, and tests simultaneously**, so that I can **complete features 3x faster without context-switching**.

**Acceptance Criteria:**
- Can spawn multiple agents with a single command
- Each agent has isolated environment
- Can see all agent progress in one view
- Can merge all work when complete

### Story 2: Safe Experimentation

> As a **developer exploring a new approach**, I want to **let an agent experiment in a sandboxed environment**, so that I can **easily discard changes if the approach doesn't work**.

**Acceptance Criteria:**
- Agent cannot affect main branch
- Can view all changes before committing
- Can restore to any checkpoint
- Can discard entire branch with one action

### Story 3: Team Coordination

> As a **tech lead**, I want to **see what all my team's agents are doing**, so that I can **identify overlaps early and coordinate work**.

**Acceptance Criteria:**
- Dashboard shows all active agents
- Overlap detector highlights when agents touch same files
- Can pause/redirect agents as needed
- Can review and approve agent work

---

*Document Version: 1.1*
*Last Updated: 2026-02-04*

---

## Changelog

### v1.1 - Developer Review Updates
- Simplified environment isolation to git worktrees only (containers deferred)
- Removed plugin system from MVP (extract patterns later)
- Removed AI-assisted merge resolution (AI explains, user resolves)
- Scoped to desktop app only (web/VS Code deferred based on demand)
- Simplified concurrency to max agent limit (no complex scheduling)
- Simplified checkpoint compression (git + gzip)
- Added Shared Context Store for cross-agent knowledge sharing
- Renamed "Conflict Radar" to "Overlap Detector" with honest scope
