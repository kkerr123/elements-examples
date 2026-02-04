import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import type { IpcChannel, IpcRequest, IpcResponse, Project } from '@nexus/shared';
import {
  projectManager,
  settingsManager,
  SessionStorage,
  Repository,
  AgentRuntime,
  createAgent,
  CheckpointManager,
  type AgentState,
  type AgentMessage,
  type ToolCall,
  type ToolCallResult,
} from '@nexus/core';

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let sessionStorage: SessionStorage | null = null;
let checkpointManager: CheckpointManager | null = null;

// Agent management
const runningAgents = new Map<string, AgentRuntime>();

// Helper to send events to renderer
function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

const isDev = process.env.NODE_ENV === 'development';

async function initialize(): Promise<void> {
  // Initialize settings manager
  await settingsManager.initialize();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS native title bar
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: settingsManager.get('theme') === 'dark' ? '#0a0a0a' : '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  await initialize();
  createWindow();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS: keep app running until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// =============================================================================
// IPC Handlers
// =============================================================================

// Generic IPC handler wrapper
function handleIpc<T, R>(
  channel: IpcChannel,
  handler: (payload: T) => Promise<R>
): void {
  ipcMain.handle(channel, async (_event, request: IpcRequest<T>): Promise<IpcResponse<R>> => {
    try {
      const data = await handler(request.payload);
      return {
        success: true,
        data,
        requestId: request.requestId,
      };
    } catch (error) {
      console.error(`Error in ${channel}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: request.requestId,
      };
    }
  });
}

// =============================================================================
// Project Handlers
// =============================================================================

// Open project with file picker
handleIpc('project:open', async (payload: { path?: string }) => {
  let projectPath = payload?.path;

  // If no path provided, show file picker
  if (!projectPath && mainWindow) {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Folder',
      buttonLabel: 'Open Project',
    });

    if (result.canceled || result.filePaths.length === 0) {
      throw new Error('No folder selected');
    }

    projectPath = result.filePaths[0];
  }

  if (!projectPath) {
    throw new Error('No project path provided');
  }

  // Validate it's a git repo
  const isRepo = await Repository.isGitRepository(projectPath);
  if (!isRepo) {
    throw new Error('Selected folder is not a git repository');
  }

  // Open the project
  const project = await projectManager.open(projectPath);

  // Initialize session storage for this project
  sessionStorage = new SessionStorage(projectManager.getSessionsDir());

  // Initialize checkpoint manager
  checkpointManager = new CheckpointManager(
    projectPath,
    projectManager.getCheckpointsDir()
  );
  await checkpointManager.initialize();

  // Add to recent projects
  await settingsManager.addRecentProject({
    id: project.id,
    name: project.name,
    path: project.path,
    lastOpenedAt: new Date().toISOString(),
  });

  // Get repository info
  const repoInfo = await projectManager.getRepositoryInfo();

  return {
    project,
    repoInfo,
  };
});

// List recent projects
handleIpc('project:list', async () => {
  const recentProjects = settingsManager.getRecentProjects();
  return { projects: recentProjects };
});

// Get current project info
ipcMain.handle('project:current', async () => {
  if (!projectManager.isOpen()) {
    return { success: true, data: null, requestId: '' };
  }

  const repoInfo = await projectManager.getRepositoryInfo();
  return { success: true, data: { repoInfo }, requestId: '' };
});

// =============================================================================
// Settings Handlers
// =============================================================================

ipcMain.handle('settings:get', async () => {
  return {
    success: true,
    data: settingsManager.getSettings(),
    requestId: '',
  };
});

ipcMain.handle('settings:set', async (_event, { key, value }) => {
  await settingsManager.set(key, value);
  return { success: true, data: null, requestId: '' };
});

ipcMain.handle('settings:getApiKey', async () => {
  return {
    success: true,
    data: { hasKey: settingsManager.hasApiKey() },
    requestId: '',
  };
});

ipcMain.handle('settings:setApiKey', async (_event, { apiKey }) => {
  await settingsManager.setAnthropicApiKey(apiKey);
  return { success: true, data: null, requestId: '' };
});

// =============================================================================
// Session Handlers
// =============================================================================

handleIpc('session:create', async (payload: { agentId: string; title?: string }) => {
  if (!sessionStorage) {
    throw new Error('No project is open');
  }

  const session = await sessionStorage.create(payload.agentId, payload.title);
  return session;
});

handleIpc('session:list', async () => {
  if (!sessionStorage) {
    return { sessions: [] };
  }

  const sessions = await sessionStorage.list();
  return { sessions };
});

handleIpc('session:get', async (payload: { sessionId: string }) => {
  if (!sessionStorage) {
    throw new Error('No project is open');
  }

  const session = await sessionStorage.load(payload.sessionId);
  return session;
});

handleIpc('session:message', async (payload: { sessionId: string; message: any }) => {
  if (!sessionStorage) {
    throw new Error('No project is open');
  }

  await sessionStorage.appendMessage(payload.sessionId, payload.message);
  return { success: true };
});

// =============================================================================
// Agent Handlers
// =============================================================================

interface SpawnAgentPayload {
  name: string;
  task: string;
  permissionMode?: 'explore' | 'ask' | 'auto';
  sessionId?: string;
  useWorktree?: boolean;
}

handleIpc('agent:spawn', async (payload: SpawnAgentPayload) => {
  console.log('Spawning agent:', payload);

  // Check if API key is configured
  const apiKey = settingsManager.getAnthropicApiKey();
  if (!apiKey) {
    throw new Error('Please configure your Anthropic API key in Settings');
  }

  // Check if project is open
  if (!projectManager.isOpen()) {
    throw new Error('No project is open');
  }

  // Determine working directory
  let workingDirectory = projectManager.getProject()!.path;

  // Optionally create a worktree for isolation
  if (payload.useWorktree) {
    const worktreeManager = projectManager.getWorktreeManager();
    const worktreeName = `agent-${Date.now()}`;
    const worktree = await worktreeManager.create({
      name: worktreeName,
      baseBranch: 'HEAD',
    });
    workingDirectory = worktree.path;
  }

  // Create agent
  const agent = createAgent(
    {
      name: payload.name,
      workingDirectory,
      permissionMode: payload.permissionMode || 'ask',
      systemPrompt: `You are ${payload.name}, an AI assistant helping with software development tasks.

Current project: ${projectManager.getProject()!.name}
Working directory: ${workingDirectory}

Your task: ${payload.task}

Work carefully and methodically. Read relevant files before making changes. Explain your actions.`,
    },
    apiKey
  );

  const agentId = agent.getConfig().id;

  // Set up event forwarding to renderer
  agent.on('status', (status) => {
    sendToRenderer('agent:event', { agentId, type: 'status', data: status });
  });

  agent.on('message', (message: AgentMessage) => {
    sendToRenderer('agent:event', { agentId, type: 'message', data: message });

    // Also save to session if we have one
    if (payload.sessionId && sessionStorage) {
      sessionStorage.appendMessage(payload.sessionId, {
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        toolCalls: message.toolCalls,
        toolResults: message.toolResults,
      });
    }
  });

  agent.on('text', (text) => {
    sendToRenderer('agent:event', { agentId, type: 'text', data: text });
  });

  agent.on('tool_call', (toolCall: ToolCall) => {
    sendToRenderer('agent:event', { agentId, type: 'tool_call', data: toolCall });
  });

  agent.on('tool_result', (result: ToolCallResult) => {
    sendToRenderer('agent:event', { agentId, type: 'tool_result', data: result });
  });

  agent.on('approval_required', (toolCalls: ToolCall[]) => {
    sendToRenderer('agent:event', { agentId, type: 'approval_required', data: toolCalls });
  });

  agent.on('turn_complete', (turnNumber) => {
    sendToRenderer('agent:event', { agentId, type: 'turn_complete', data: turnNumber });
  });

  agent.on('complete', (state: AgentState) => {
    sendToRenderer('agent:event', { agentId, type: 'complete', data: state });
    runningAgents.delete(agentId);
  });

  agent.on('error', (error: Error) => {
    sendToRenderer('agent:event', { agentId, type: 'error', data: error.message });
    runningAgents.delete(agentId);
  });

  // Store agent reference
  runningAgents.set(agentId, agent);

  // Start the agent (don't await - it runs in the background)
  agent.run(payload.task).catch((err) => {
    console.error('Agent error:', err);
  });

  return {
    id: agentId,
    name: agent.getConfig().name,
    status: agent.getState().status,
    workingDirectory,
  };
});

handleIpc('agent:pause', async (payload: { agentId: string }) => {
  const agent = runningAgents.get(payload.agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }
  agent.pause();
  return { success: true, status: agent.getState().status };
});

handleIpc('agent:resume', async (payload: { agentId: string }) => {
  const agent = runningAgents.get(payload.agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }
  agent.resume();
  return { success: true, status: agent.getState().status };
});

handleIpc('agent:terminate', async (payload: { agentId: string }) => {
  const agent = runningAgents.get(payload.agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }
  agent.terminate();
  runningAgents.delete(payload.agentId);
  return { success: true };
});

handleIpc('agent:status', async (payload: { agentId: string }) => {
  const agent = runningAgents.get(payload.agentId);
  if (!agent) {
    return { status: 'not_found' };
  }
  return agent.getState();
});

handleIpc('agent:approve', async (payload: { agentId: string; toolCallIds: string[] }) => {
  const agent = runningAgents.get(payload.agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }
  agent.approveToolCalls(payload.toolCallIds);
  return { success: true };
});

handleIpc('agent:reject', async (payload: { agentId: string; toolCallIds: string[] }) => {
  const agent = runningAgents.get(payload.agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }
  agent.rejectToolCalls(payload.toolCallIds);
  return { success: true };
});

handleIpc('agent:list', async () => {
  const agents = Array.from(runningAgents.entries()).map(([id, agent]) => ({
    id,
    name: agent.getConfig().name,
    status: agent.getState().status,
    currentTask: agent.getState().currentTask,
    turnCount: agent.getState().turnCount,
  }));
  return { agents };
});

handleIpc('agent:sendMessage', async (payload: { agentId: string; message: string }) => {
  const agent = runningAgents.get(payload.agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }

  // If agent is idle, start it with the new message
  const state = agent.getState();
  if (state.status === 'idle' || state.status === 'completed') {
    agent.run(payload.message);
  } else {
    throw new Error('Agent is busy. Please wait for it to complete or pause it first.');
  }

  return { success: true };
});

// =============================================================================
// Checkpoint Handlers
// =============================================================================

interface CreateCheckpointPayload {
  agentId: string;
  sessionId: string;
  trigger?: 'auto' | 'manual' | 'milestone';
  description?: string;
}

handleIpc('checkpoint:create', async (payload: CreateCheckpointPayload) => {
  if (!checkpointManager) {
    throw new Error('No project is open');
  }

  // Get the agent to capture its state
  const agent = runningAgents.get(payload.agentId);
  const agentState = agent ? agent.getState() : null;

  const checkpoint = await checkpointManager.create({
    agentId: payload.agentId,
    sessionId: payload.sessionId,
    trigger: payload.trigger || 'manual',
    description: payload.description,
    conversationState: {
      sessionId: payload.sessionId,
      messages: agentState?.messages || [],
      agentState: agentState,
      timestamp: new Date().toISOString(),
    },
  });

  return checkpoint;
});

handleIpc('checkpoint:restore', async (payload: { checkpointId: string; targetPath?: string }) => {
  if (!checkpointManager) {
    throw new Error('No project is open');
  }

  const targetPath = payload.targetPath || projectManager.getProject()?.path;
  if (!targetPath) {
    throw new Error('No target path for restoration');
  }

  const result = await checkpointManager.restore(payload.checkpointId, targetPath);
  if (!result.success) {
    throw new Error(result.error);
  }

  // Load the conversation state
  const conversationState = await checkpointManager.loadConversationState(payload.checkpointId);

  return {
    success: true,
    conversationState,
  };
});

handleIpc('checkpoint:list', async (payload: { agentId?: string; sessionId?: string }) => {
  if (!checkpointManager) {
    return { checkpoints: [] };
  }

  let checkpoints: Awaited<ReturnType<typeof checkpointManager.listByAgent>> = [];
  if (payload.agentId) {
    checkpoints = await checkpointManager.listByAgent(payload.agentId);
  } else if (payload.sessionId) {
    checkpoints = await checkpointManager.listBySession(payload.sessionId);
  }

  return { checkpoints };
});

handleIpc('checkpoint:get', async (payload: { checkpointId: string }) => {
  if (!checkpointManager) {
    throw new Error('No project is open');
  }

  const checkpoint = await checkpointManager.get(payload.checkpointId);
  if (!checkpoint) {
    throw new Error('Checkpoint not found');
  }

  return checkpoint;
});

handleIpc('checkpoint:delete', async (payload: { checkpointId: string }) => {
  if (!checkpointManager) {
    throw new Error('No project is open');
  }

  await checkpointManager.delete(payload.checkpointId);
  return { success: true };
});

handleIpc('checkpoint:diff', async (payload: { fromCheckpointId: string; toCheckpointId: string }) => {
  if (!checkpointManager) {
    throw new Error('No project is open');
  }

  const diff = await checkpointManager.diff(payload.fromCheckpointId, payload.toCheckpointId);
  return { diff };
});
