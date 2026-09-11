import { App } from './ui/app';

export function initializeApp(): void {
  const root = document.getElementById('root') || document.getElementById('app');
  if (!root) {
    throw new Error('Root #root container not found in DOM');
  }

  // Instantiate application controller
  new App(root);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    const container = document.getElementById('root') || document.getElementById('app');
    if (container) {
      initializeApp();
    }
  }
}
