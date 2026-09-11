import { apiClient } from '../api/api-client';

interface StartScreenProps {
  onStartGame: () => void;
  isLoading: boolean;
}

export function renderStartScreen(props: StartScreenProps): HTMLElement {
  const container = document.createElement('div');
  container.className = 'start-container animate-fade-in';

  container.innerHTML = `
    <div class="hero-visual">
      <div class="mystic-orb-outer">
        <div class="mystic-orb-inner"></div>
        <svg class="mystic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path>
          <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"></path>
        </svg>
      </div>
    </div>

    <div class="hero-header">
      <span class="hero-badge">AI Decision Tree Engine</span>
      <h1 class="hero-title">Mind-Mancer</h1>
      <p class="hero-tagline">The Adaptive Character Guessing Oracle</p>
    </div>

    <div class="hero-instructions">
      <div class="instruction-step">
        <span class="step-num">1</span>
        <span>Think of any fictional character, superhero, or pop-culture icon.</span>
      </div>
      <div class="instruction-step">
        <span class="step-num">2</span>
        <span>Answer questions with <strong>Yes</strong>, <strong>No</strong>, <strong>Probably</strong>, or <strong>Don't Know</strong>.</span>
      </div>
      <div class="instruction-step">
        <span class="step-num">3</span>
        <span>Watch the decision tree narrow the candidate pool to guess your entity!</span>
      </div>
    </div>

    <div class="start-actions">
      <button type="button" class="btn btn-primary btn-large" id="btn-start-game" ${props.isLoading ? 'disabled' : ''}>
        ${props.isLoading ? '<span class="spinner"></span> Awakening Mind-Mancer...' : 'Begin Mind Reading'}
      </button>
    </div>

    <div class="system-status-indicator" id="system-status-pill">
      <span class="status-indicator-dot dot-checking"></span>
      <span class="status-indicator-text">Connecting to Oracle...</span>
    </div>
  `;

  const btnStart = container.querySelector('#btn-start-game');
  btnStart?.addEventListener('click', () => {
    props.onStartGame();
  });

  // Check health asynchronously to display live connection status pill
  const statusPill = container.querySelector('#system-status-pill');
  apiClient
    .checkHealth()
    .then((health) => {
      if (statusPill) {
        const isReady = health.status === 'healthy';
        const mlActive = health.mlService?.status === 'connected';
        statusPill.innerHTML = `
          <span class="status-indicator-dot ${isReady ? 'dot-online' : 'dot-degraded'}"></span>
          <span class="status-indicator-text">Backend: ${health.status} | ML Engine: ${mlActive ? 'Online' : 'Fallback Mode'}</span>
        `;
      }
    })
    .catch(() => {
      if (statusPill) {
        statusPill.innerHTML = `
          <span class="status-indicator-dot dot-offline"></span>
          <span class="status-indicator-text">Backend Offline (Ensure port 3000 is active)</span>
        `;
      }
    });

  return container;
}
