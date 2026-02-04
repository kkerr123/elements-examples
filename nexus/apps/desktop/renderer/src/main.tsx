import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initializeTheme } from './hooks/use-theme';
import './styles/globals.css';

// Initialize theme before render to prevent flash
initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
