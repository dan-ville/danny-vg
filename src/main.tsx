import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { MotionProvider } from './context/MotionContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </MotionProvider>
  </StrictMode>,
);
