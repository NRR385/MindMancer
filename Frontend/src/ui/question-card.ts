import { IQuestionPayload } from '../types/game.types';

export function renderQuestionCard(question: IQuestionPayload): HTMLElement {
  const card = document.createElement('div');
  card.className = 'question-card animate-fade-in';

  const iconContainer = document.createElement('div');
  iconContainer.className = 'question-icon-container';
  iconContainer.innerHTML = `
    <div class="crystal-orb">
      <div class="crystal-glow"></div>
      <svg class="orb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 3a9 9 0 0 1 9 9"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    </div>
  `;

  const badge = document.createElement('div');
  badge.className = 'question-badge';
  badge.textContent = `Question #${question.questionCount}`;

  const questionText = document.createElement('h2');
  questionText.className = 'question-text';
  questionText.id = 'current-question-text';
  questionText.textContent = question.text;

  const featurePill = document.createElement('span');
  featurePill.className = 'feature-slug-pill';
  featurePill.textContent = `Key: ${question.featureKey}`;

  card.appendChild(iconContainer);
  card.appendChild(badge);
  card.appendChild(questionText);
  card.appendChild(featurePill);

  return card;
}
