import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyAccentColor, resolveInitialAccentColor } from '../shared/colorTheme';
import { applyTheme, resolveInitialTheme } from '../shared/theme';
import './global.css';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { ToastProvider } from './ui/Toast';

const initialTheme = resolveInitialTheme();
applyTheme(initialTheme);
applyAccentColor(resolveInitialAccentColor(), initialTheme);
void window.electronAPI?.setNativeTheme?.(initialTheme);

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
