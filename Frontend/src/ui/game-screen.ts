import { IQuestionPayload, AnswerType } from '../types/game.types';
import { renderProgressBar } from './progress';
import { renderQuestionCard } from './question-card';
import { renderAnswerButtons } from './answer-buttons';

interface GameScreenProps {
  question: IQuestionPayload;
  questionCount: number;
  isLoading: boolean;
  onAnswer: (answer: AnswerType) => void;
  onRestart: () => void;
}

export function renderGameScreen(props: GameScreenProps): HTMLElement {
  const container = document.createElement('div');
  container.className = 'game-screen-container';

  // Navigation Bar
  const nav = document.createElement('div');
  nav.className = 'game-screen-nav';
  nav.innerHTML = `
    <div class="nav-brand">
      <span class="nav-brand-orb"></span>
      <span class="nav-brand-title">Mind-Mancer</span>
    </div>
    <button type="button" class="btn-text-restart" id="btn-nav-restart" title="Abandon game and restart">
      <svg class="restart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
      </svg>
      Restart Game
    </button>
  `;

  const btnRestart = nav.querySelector('#btn-nav-restart');
  btnRestart?.addEventListener('click', () => {
    if (confirm('Are you sure you want to restart this game session?')) {
      props.onRestart();
    }
  });

  // Progress Bar
  const progressBar = renderProgressBar(props.questionCount || props.question.questionCount, 20);

  // Question Card
  const questionCard = renderQuestionCard(props.question);

  // Answer Buttons
  const answerButtons = renderAnswerButtons(props.onAnswer, props.isLoading);

  container.appendChild(nav);
  container.appendChild(progressBar);
  container.appendChild(questionCard);
  container.appendChild(answerButtons);

  return container;
}
