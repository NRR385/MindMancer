import { TerminalReason } from '../types/game.types';

interface GuessScreenProps {
  guess: {
    name: string;
    relativeScore: number;
    reason: TerminalReason;
  };
  questionCount: number;
  topCandidates: Array<{ name: string; relativeScore: number }>;
  onConfirmCorrect: () => void;
  onRejectGuess: () => void;
}

export function renderGuessScreen(props: GuessScreenProps): HTMLElement {
  const container = document.createElement('div');
  container.className = 'guess-container animate-fade-in';

  const reasonLabels: Record<TerminalReason, { title: string; desc: string }> = {
    DOMINANT_THRESHOLD: {
      title: 'Dominant Confidence',
      desc: 'Top candidate evidence score >= 65% with significant separation.',
    },
    MAX_QUESTIONS: {
      title: '20 Questions Reached',
      desc: 'Maximum questions reached. Best available candidate without reaching dominant threshold.',
    },
    EXHAUSTED: {
      title: 'Questions Exhausted',
      desc: 'All distinguishing questions exhausted. Best relative candidate.',
    },
    TRIVIAL_KNOWLEDGE_BASE: {
      title: 'Sole Candidate',
      desc: 'Only one candidate exists in the current knowledge base.',
    },
  };

  const reasonInfo = reasonLabels[props.guess.reason] || {
    title: props.guess.reason,
    desc: 'Conclusion reached.',
  };

  const percentage = Math.round(props.guess.relativeScore * 100);

  container.innerHTML = `
    <div class="guess-header">
      <div class="guess-badge">
        <span class="pulse-dot"></span>
        <span>${reasonInfo.title}</span>
      </div>
      <p class="guess-subtext">After ${props.questionCount} question${props.questionCount === 1 ? '' : 's'}, Mind-Mancer predicts:</p>
    </div>

    <div class="guess-card">
      <div class="guess-glow"></div>
      <span class="guess-intro">I believe your character is...</span>
      <h1 class="guess-character-name" id="guessed-character-name">${props.guess.name}</h1>
      
      <div class="score-meter-container">
        <div class="score-meter-header">
          <span>Relative Candidate Score</span>
          <span class="score-percent">${percentage}%</span>
        </div>
        <div class="score-track">
          <div class="score-fill" style="width: ${percentage}%;"></div>
        </div>
        <p class="score-disclaimer">
          *Relative evidence score within the current knowledge base; not a calibrated probability.
        </p>
      </div>

      <div class="reason-box">
        <span class="reason-note">Decision Criteria:</span>
        <span class="reason-desc">${reasonInfo.desc}</span>
      </div>
    </div>

    <div class="guess-confirmation-box">
      <p class="confirm-prompt">Did Mind-Mancer read your mind correctly?</p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-success" id="btn-guess-correct">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Yes, that's who I was thinking of!
        </button>
        <button type="button" class="btn btn-outline" id="btn-guess-wrong">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          No, that is incorrect
        </button>
      </div>
    </div>
  `;

  // Attach button event handlers
  const btnCorrect = container.querySelector('#btn-guess-correct');
  const btnWrong = container.querySelector('#btn-guess-wrong');

  btnCorrect?.addEventListener('click', () => props.onConfirmCorrect());
  btnWrong?.addEventListener('click', () => props.onRejectGuess());

  return container;
}
