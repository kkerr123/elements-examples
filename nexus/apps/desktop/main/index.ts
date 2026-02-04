import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import type { IpcChannel, IpcRequest, IpcResponse } from '@nexus/shared';

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS native title bar
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0a0a', // Dark background to prevent flash
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
app.whenReady().then(() => {
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: request.requestId,
      };
    }
  });
}

// Agent handlers
handleIpc('agent:spawn', async (payload) => {
  console.log('Spawning agent:', payload);
  // TODO: Implement agent spawning with git worktree
  return { id: crypto.randomUUID(), status: 'queued' };
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

// Session handlers
handleIpc('session:create', async (payload) => {
  console.log('Creating session:', payload);
  return { id: crypto.randomUUID() };
});

handleIpc('session:list', async () => {
  console.log('Listing sessions');
  return { sessions: [] };
});

handleIpc('session:get', async (payload) => {
  console.log('Getting session:', payload);
  return null;
});

handleIpc('session:message', async (payload) => {
  console.log('Sending message:', payload);
  return { id: crypto.randomUUID() };
});

// Project handlers
handleIpc('project:open', async (payload) => {
  console.log('Opening project:', payload);
  return { id: crypto.randomUUID(), name: 'Test Project', path: '/tmp/test' };
});

handleIpc('project:list', async () => {
  console.log('Listing projects');
  return { projects: [] };
});

// Checkpoint handlers
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
