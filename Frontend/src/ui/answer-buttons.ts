import { AnswerType } from '../types/game.types';

interface AnswerOption {
  type: AnswerType;
  label: string;
  shortcut: string;
  variantClass: string;
}

const ANSWER_OPTIONS: AnswerOption[] = [
  { type: 'YES', label: 'Yes', shortcut: '1', variantClass: 'btn-yes' },
  { type: 'PROBABLY', label: 'Probably', shortcut: '2', variantClass: 'btn-probably' },
  { type: 'DONT_KNOW', label: "Don't Know", shortcut: '3', variantClass: 'btn-dont-know' },
  { type: 'PROBABLY_NOT', label: 'Probably Not', shortcut: '4', variantClass: 'btn-probably-not' },
  { type: 'NO', label: 'No', shortcut: '5', variantClass: 'btn-no' },
];

export function renderAnswerButtons(
  onAnswer: (answer: AnswerType) => void,
  disabled = false
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'answer-grid';

  ANSWER_OPTIONS.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `answer-btn ${opt.variantClass}`;
    btn.id = `btn-answer-${opt.type.toLowerCase()}`;
    btn.disabled = disabled;

    btn.innerHTML = `
      <span class="btn-label">${opt.label}</span>
      <span class="btn-shortcut" title="Press '${opt.shortcut}' key">${opt.shortcut}</span>
    `;

    btn.addEventListener('click', () => {
      if (!disabled) {
        onAnswer(opt.type);
      }
    });

    container.appendChild(btn);
  });

  return container;
}
