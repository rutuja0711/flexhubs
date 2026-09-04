import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme, resolveInitialTheme } from '../shared/theme';
import './global.css';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';

applyTheme(resolveInitialTheme());

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
}
