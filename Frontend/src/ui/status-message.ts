export function renderErrorBanner(errorMessage: string, onDismiss: () => void): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'error-banner animate-slide-down';

  banner.innerHTML = `
    <div class="error-content">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span class="error-text">${errorMessage}</span>
    </div>
    <button type="button" class="error-dismiss" aria-label="Dismiss error">
      &times;
    </button>
  `;

  const btnDismiss = banner.querySelector('.error-dismiss');
  btnDismiss?.addEventListener('click', () => {
    onDismiss();
  });

  return banner;
}

export function renderLoadingOverlay(message = 'Consulting the Decision Tree...'): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';

  overlay.innerHTML = `
    <div class="loading-modal">
      <div class="loading-spinner"></div>
      <p class="loading-message">${message}</p>
    </div>
  `;

  return overlay;
}
