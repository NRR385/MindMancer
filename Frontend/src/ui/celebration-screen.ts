interface CelebrationScreenProps {
  characterName: string;
  questionCount: number;
  onPlayAgain: () => void;
}

export function renderCelebrationScreen(props: CelebrationScreenProps): HTMLElement {
  const container = document.createElement('div');
  container.className = 'celebration-container animate-scale-up';

  container.innerHTML = `
    <div class="celebration-icon">
      <div class="trophy-glow"></div>
      <svg class="trophy-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
        <path d="M4 22h16"></path>
        <path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-2c-.55 0-1-.45-1-1v-2.34"></path>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>
      </svg>
    </div>

    <div class="celebration-badge">Mind Read Successful!</div>
    <h1 class="celebration-title">Another Mind Read!</h1>
    <p class="celebration-desc">
      Mind-Mancer correctly identified <strong>${props.characterName}</strong> in <strong>${props.questionCount}</strong> question${props.questionCount === 1 ? '' : 's'}!
    </p>

    <div class="celebration-actions">
      <button type="button" class="btn btn-primary" id="btn-play-again">
        Play Another Game
      </button>
    </div>
  `;

  const btnPlayAgain = container.querySelector('#btn-play-again');
  btnPlayAgain?.addEventListener('click', () => {
    props.onPlayAgain();
  });

  return container;
}
