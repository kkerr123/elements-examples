import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import type { IpcChannel, IpcRequest, IpcResponse, Project } from '@nexus/shared';
import {
  projectManager,
  settingsManager,
  SessionStorage,
  Repository,
} from '@nexus/core';

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let sessionStorage: SessionStorage | null = null;

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
// Agent Handlers (TODO: Implement with actual agent runtime)
// =============================================================================

handleIpc('agent:spawn', async (payload) => {
  console.log('Spawning agent:', payload);

  // Check if API key is configured
  if (!settingsManager.hasApiKey()) {
    throw new Error('Please configure your Anthropic API key in Settings');
  }

  // TODO: Implement actual agent spawning with git worktree
  // For now, return mock data
  return {
    id: crypto.randomUUID(),
    status: 'queued',
    message: 'Agent spawning not yet implemented',
  };
});

handleIpc('agent:pause', async (payload) => {
  console.log('Pausing agent:', payload);
  return { success: true };
});

handleIpc('agent:resume', async (payload) => {
  console.log('Resuming agent:', payload);
  return { success: true };
});

handleIpc('agent:terminate', async (payload) => {
  console.log('Terminating agent:', payload);
  return { success: true };
});

handleIpc('agent:status', async (payload) => {
  console.log('Getting agent status:', payload);
  return { status: 'running' };
});

// =============================================================================
// Checkpoint Handlers (TODO: Implement)
// =============================================================================

handleIpc('checkpoint:create', async (payload) => {
  console.log('Creating checkpoint:', payload);
  return { id: crypto.randomUUID() };
});

handleIpc('checkpoint:restore', async (payload) => {
  console.log('Restoring checkpoint:', payload);
  return { success: true };
});

handleIpc('checkpoint:list', async (payload) => {
  console.log('Listing checkpoints:', payload);
  return { checkpoints: [] };
});
