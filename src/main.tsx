import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initDatabase } from './lib/sqlite';

async function startApp() {
  try {
    await initDatabase();
    console.log('SQLite prêt');
  } catch (error) {
    console.error('Erreur lors de l’initialisation de SQLite:', error);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

startApp();