import { ITeachGameResponse } from '../types/game.types';

export interface TeachingScreenProps {
  wrongGuessName: string;
  onSubmitTeaching: (
    charName: string,
    question: string,
    answer: 'YES' | 'NO',
    category?: string
  ) => void;
  onPlayAgain: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  successResult?: ITeachGameResponse | null;
}

export function renderTeachingScreen(props: TeachingScreenProps): HTMLElement {
  const container = document.createElement('div');
  container.className = 'teaching-container animate-fade-in';

  // If knowledge handoff already succeeded, render confirmation view
  if (props.successResult) {
    const isRetrained = props.successResult.model?.retrained;
    const modelMeta = props.successResult.model;

    container.innerHTML = `
      <div class="teaching-header">
        <div class="teaching-badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80;">
          <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Knowledge Learned</span>
        </div>
        <h2>Mind-Mancer has expanded!</h2>
        <p class="teaching-desc">
          Successfully incorporated <strong>${props.successResult.character.name}</strong> into the canonical knowledge base.
        </p>
      </div>

      <div class="teaching-summary-card" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
        <div style="margin-bottom: 0.75rem;">
          <span style="color: #94a3b8; font-size: 0.85rem;">Entity Learned:</span>
          <div style="font-size: 1.25rem; font-weight: 700; color: #f8fafc;">${props.successResult.character.name}</div>
        </div>
        <div style="margin-bottom: 0.75rem;">
          <span style="color: #94a3b8; font-size: 0.85rem;">Distinguishing Question:</span>
          <div style="color: #e2e8f0; font-style: italic;">"${props.successResult.feature.question}"</div>
        </div>
        <div style="margin-bottom: 0.75rem;">
          <span style="color: #94a3b8; font-size: 0.85rem;">Trait Value:</span>
          <span style="display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 600; font-size: 0.85rem; background: ${props.successResult.character.taughtTrait.value ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${props.successResult.character.taughtTrait.value ? '#4ade80' : '#f87171'};">
            ${props.successResult.character.taughtTrait.value ? 'YES' : 'NO'}
          </span>
        </div>
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 0.75rem; font-size: 0.9rem;">
          ${
            isRetrained
              ? `<span style="color: #4ade80;">Active Decision Tree retrained with ${modelMeta?.characterCount} characters and ${modelMeta?.featureCount} questions.</span>`
              : `<span style="color: #fbbf24;">Knowledge saved to database. Note: ML model retraining is pending/unavailable.</span>`
          }
        </div>
      </div>

      <div class="form-actions" style="margin-top: 1.5rem;">
        <button type="button" class="btn btn-primary" id="btn-play-again-after-teach" style="width: 100%;">
          Play Again with Updated Knowledge
        </button>
      </div>
    `;

    const btnPlayAgain = container.querySelector('#btn-play-again-after-teach');
    btnPlayAgain?.addEventListener('click', () => {
      props.onPlayAgain();
    });

    return container;
  }

  // Otherwise render the teaching form
  container.innerHTML = `
    <div class="teaching-header">
      <div class="teaching-badge">
        <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        <span>Knowledge Handoff</span>
      </div>
      <h2>Mind-Mancer was stumped!</h2>
      <p class="teaching-desc">
        Mind-Mancer missed your character! Provide the entity you had in mind and a question that distinguishes them from <strong>${props.wrongGuessName}</strong>.
      </p>
    </div>

    ${
      props.errorMessage
        ? `<div class="error-banner" style="margin-bottom: 1.5rem; text-align: left;">
            <strong>Teaching Error:</strong> ${props.errorMessage}
          </div>`
        : ''
    }

    <form class="teaching-form" id="teaching-form">
      <div class="form-group">
        <label for="char-name-input">Character Name <span class="required">*</span></label>
        <input
          type="text"
          id="char-name-input"
          class="form-input"
          placeholder="e.g. Luke Skywalker"
          required
          maxlength="100"
          autocomplete="off"
          ${props.isLoading ? 'disabled' : ''}
        />
        <span class="field-hint">The exact name of the entity you had in mind (1-100 characters).</span>
      </div>

      <div class="form-group">
        <label for="char-question-input">Distinguishing Question <span class="required">*</span></label>
        <input
          type="text"
          id="char-question-input"
          class="form-input"
          placeholder="e.g. Does your character wield a green lightsaber?"
          required
          minlength="10"
          maxlength="120"
          autocomplete="off"
          ${props.isLoading ? 'disabled' : ''}
        />
        <span class="field-hint">Must be 10–120 characters and end with a question mark (?).</span>
      </div>

      <div class="form-group">
        <label for="char-category-input">Question Category</label>
        <input
          type="text"
          id="char-category-input"
          class="form-input"
          placeholder="e.g. skills, appearance, equipment, biology"
          maxlength="50"
          autocomplete="off"
          ${props.isLoading ? 'disabled' : ''}
        />
        <span class="field-hint">Optional category descriptor (defaults to 'skills' or 'general').</span>
      </div>

      <div class="form-group">
        <label>What would the answer be for your character?</label>
        <div class="toggle-group">
          <label class="toggle-option">
            <input type="radio" name="trait-answer" value="YES" checked ${props.isLoading ? 'disabled' : ''} />
            <span class="toggle-pill pill-yes">Yes</span>
          </label>
          <label class="toggle-option">
            <input type="radio" name="trait-answer" value="NO" ${props.isLoading ? 'disabled' : ''} />
            <span class="toggle-pill pill-no">No</span>
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="btn-submit-teach" ${props.isLoading ? 'disabled' : ''}>
          ${props.isLoading ? 'Persisting & Retraining...' : 'Submit Teaching Handoff'}
        </button>
        <button type="button" class="btn btn-outline" id="btn-cancel-teach" ${props.isLoading ? 'disabled' : ''}>
          Skip & Play Again
        </button>
      </div>
    </form>
  `;

  const form = container.querySelector('#teaching-form') as HTMLFormElement;
  const btnCancel = container.querySelector('#btn-cancel-teach');

  btnCancel?.addEventListener('click', () => {
    props.onPlayAgain();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (props.isLoading) return;

    const nameInput = container.querySelector('#char-name-input') as HTMLInputElement;
    const qInput = container.querySelector('#char-question-input') as HTMLInputElement;
    const catInput = container.querySelector('#char-category-input') as HTMLInputElement;
    const answerInput = container.querySelector('input[name="trait-answer"]:checked') as HTMLInputElement;

    const name = nameInput.value.trim();
    let question = qInput.value.trim();
    if (!question.endsWith('?')) {
      question += '?';
    }

    // Explicit client validation guard (supports JSDOM test environments without browser native validation)
    if (!name || name.length === 0 || name.length > 100) {
      return;
    }
    if (!question || question.length < 10 || question.length > 120) {
      return;
    }

    const category = catInput?.value.trim() || 'skills';
    const answer = (answerInput?.value as 'YES' | 'NO') || 'YES';

    props.onSubmitTeaching(name, question, answer, category);
  });

  return container;
}
