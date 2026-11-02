import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';
import App from './App';
import QuickPanel from './views/QuickPanel';

const isQuick = window.location.hash.startsWith('#/quick');
const root = createRoot(document.getElementById('root') as HTMLElement);

root.render(<StrictMode>{isQuick ? <QuickPanel /> : <App />}</StrictMode>);

if (isQuick) {
  document.body.style.background = 'transparent';
}
