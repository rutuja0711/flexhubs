import { contextBridge, ipcRenderer } from 'electron';
import type { LoginCredentials, LoginResult } from './shared/auth';

contextBridge.exposeInMainWorld('electronAPI', {
  login: (credentials: LoginCredentials): Promise<LoginResult> =>
    ipcRenderer.invoke('auth:login', credentials),
});
