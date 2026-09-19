import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);

// Registered after paint so it never competes with the first render.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
