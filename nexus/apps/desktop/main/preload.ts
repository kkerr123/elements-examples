import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel, IpcRequest, IpcResponse } from '@nexus/shared';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('nexus', {
  // Generic IPC invoke
  invoke: async <T, R>(channel: IpcChannel, payload: T): Promise<IpcResponse<R>> => {
    const request: IpcRequest<T> = {
      channel,
      payload,
      requestId: crypto.randomUUID(),
    };
    return ipcRenderer.invoke(channel, request);
  },

  // Event listeners for real-time updates
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },

  // Platform info
  platform: process.platform,
});

// Type augmentation for window.nexus
declare global {
  interface Window {
    nexus: {
      invoke: <T, R>(channel: IpcChannel, payload: T) => Promise<IpcResponse<R>>;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
      platform: NodeJS.Platform;
    };
  }
}
