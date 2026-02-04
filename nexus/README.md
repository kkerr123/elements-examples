# Nexus

**Agent Orchestration Platform** - Parallelize your development with isolated agent environments.

## Overview

Nexus enables developers to orchestrate a fleet of AI agents, each operating in an isolated git worktree, with unified visibility into all concurrent workflows and intelligent work merging.

## Features

- **Multi-Agent Orchestration**: Run 3-5 agents simultaneously on different concerns
- **Environment Isolation**: Each agent operates in its own git worktree
- **Visual Command Center**: Three-pane layout showing fleet, sessions, and workspace
- **Checkpoint System**: Automatic and manual checkpoints with one-click restore
- **Permission Modes**: Explore (read-only), Ask (approval required), Auto (full autonomy)
- **Skills & Sources**: Natural language configuration of MCP servers and integrations

## Tech Stack

- **Desktop**: Electron
- **UI**: React + Vite + Tailwind CSS + shadcn/ui
- **State**: Zustand
- **Build**: esbuild (main), Vite (renderer)
- **Monorepo**: pnpm workspaces

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Build for production
pnpm build
```

## Project Structure

```
nexus/
├── apps/
│   └── desktop/          # Electron app
│       ├── main/         # Main process
│       └── renderer/     # React UI
├── packages/
│   ├── shared/           # Shared types
│   ├── core/             # Agent runtime (TBD)
│   └── ui/               # Component library (TBD)
└── docs/
```

## Architecture

See [AGENT_ORCHESTRATION_SPEC.md](../AGENT_ORCHESTRATION_SPEC.md) for the full product specification.

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm typecheck` | Run TypeScript type checking |

## License

MIT
