import type { LoginCredentials, LoginResult } from '../shared/auth';

declare global {
  interface Window {
    electronAPI: {
      login: (credentials: LoginCredentials) => Promise<LoginResult>;
    };
  }
}

export {};
