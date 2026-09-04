/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#d8415f',
          hover: '#c43754',
          active: '#b0304a',
          soft: '#f07188',
        },
        app: {
          bg: 'var(--app-bg)',
          'bg-login': 'var(--app-bg-login)',
          surface: 'var(--app-surface)',
          'surface-input': 'var(--app-surface-input)',
          border: 'var(--app-border)',
          'border-strong': 'var(--app-border-strong)',
          text: 'var(--app-text)',
          muted: 'var(--app-text-muted)',
          placeholder: 'var(--app-placeholder)',
          'chat-bg': 'var(--app-chat-bg)',
          'chat-rail': 'var(--app-chat-rail)',
          'chat-sidebar': 'var(--app-chat-sidebar)',
          'chat-panel': 'var(--app-chat-panel)',
          'chat-hover': 'var(--app-chat-hover)',
          'chat-active': 'var(--app-chat-active)',
          'message-in': 'var(--app-message-in)',
          'message-out': 'var(--app-message-out)',
          'message-out-text': 'var(--app-message-out-text)',
        },
        surface: {
          DEFAULT: '#1e1e1e',
          input: '#141414',
        },
        border: {
          DEFAULT: '#2a2a2a',
          input: '#333333',
        },
        muted: '#9a9a9a',
        chat: {
          bg: 'var(--app-chat-bg)',
          rail: 'var(--app-chat-rail)',
          sidebar: 'var(--app-chat-sidebar)',
          panel: 'var(--app-chat-panel)',
          hover: 'var(--app-chat-hover)',
          active: 'var(--app-chat-active)',
        },
      },
      boxShadow: {
        app: '0 24px 48px var(--app-shadow)',
      },
    },
  },
  plugins: [],
};
