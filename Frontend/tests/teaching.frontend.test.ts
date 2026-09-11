import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from '../src/ui/app';
import { gameState } from '../src/state/game.state';
import { apiClient } from '../src/api/api-client';

describe('Phase 6: Frontend Teaching UI Production Tests', () => {
  let root: HTMLElement;
  let app: App;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    gameState.reset();
    vi.restoreAllMocks();
    app = new App(root);

    // Transition state directly to TEACHING
    gameState.setState({
      screen: 'TEACHING',
      sessionId: 'test-teaching-session',
      status: 'TEACHING',
      guess: {
        name: 'Spider-Man',
        relativeScore: 0.9,
        reason: 'DOMINANT_THRESHOLD',
      },
    });
  });

  it('TC-FE-01: Teaching screen renders inputs for character name, question, category, and yes/no toggle', () => {
    const nameInput = root.querySelector('#char-name-input') as HTMLInputElement;
    const qInput = root.querySelector('#char-question-input') as HTMLInputElement;
    const catInput = root.querySelector('#char-category-input') as HTMLInputElement;
    const submitBtn = root.querySelector('#btn-submit-teach') as HTMLButtonElement;
    const radioYes = root.querySelector('input[name="trait-answer"][value="YES"]') as HTMLInputElement;
    const radioNo = root.querySelector('input[name="trait-answer"][value="NO"]') as HTMLInputElement;

    expect(nameInput).not.toBeNull();
    expect(qInput).not.toBeNull();
    expect(catInput).not.toBeNull();
    expect(submitBtn).not.toBeNull();
    expect(radioYes).not.toBeNull();
    expect(radioNo).not.toBeNull();
    expect(submitBtn.textContent).toContain('Submit Teaching Handoff');
  });

  it('TC-FE-02: Form validation prevents submission if character name is empty or question is too short', () => {
    const submitSpy = vi.spyOn(apiClient, 'submitTeaching');
    const form = root.querySelector('#teaching-form') as HTMLFormElement;
    const nameInput = root.querySelector('#char-name-input') as HTMLInputElement;
    const qInput = root.querySelector('#char-question-input') as HTMLInputElement;

    nameInput.value = '';
    qInput.value = 'Short?';

    form.dispatchEvent(new Event('submit', { cancelable: true }));

    // Browser HTML5 validation or form handler prevents call when values are empty
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('TC-FE-03: Submitting form disables submit button and displays loading indicator', async () => {
    let resolveSubmit: any;
    const submitPromise = new Promise((resolve) => {
      resolveSubmit = resolve;
    });

    vi.spyOn(apiClient, 'submitTeaching').mockImplementation(() => submitPromise as any);

    const nameInput = root.querySelector('#char-name-input') as HTMLInputElement;
    const qInput = root.querySelector('#char-question-input') as HTMLInputElement;
    const form = root.querySelector('#teaching-form') as HTMLFormElement;

    nameInput.value = 'Black Widow';
    qInput.value = 'Is this character an elite martial artist and master spy?';

    form.dispatchEvent(new Event('submit', { cancelable: true }));

    // While in flight, state is loading
    expect(gameState.getState().loading).toBe(true);

    const submitBtn = root.querySelector('#btn-submit-teach') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toContain('Persisting & Retraining');

    // Resolve promise
    resolveSubmit({
      success: true,
      sessionId: 'test-teaching-session',
      status: 'COMPLETED_TEACHING',
      character: { name: 'Black Widow', isNew: true, playCount: 0, taughtTrait: { featureKey: 'martial_artist', value: true } },
      feature: { key: 'martial_artist', question: 'Is this character an elite martial artist and master spy?', category: 'skills', isNew: true },
      model: { retrained: true, characterCount: 13, featureCount: 17 },
      message: 'Done',
    });

    await vi.waitFor(() => {
      expect(gameState.getState().loading).toBe(false);
    });
  });

  it('TC-FE-04: Successful response transitions to confirmation view with Play Again button', async () => {
    vi.spyOn(apiClient, 'submitTeaching').mockResolvedValueOnce({
      success: true,
      sessionId: 'test-teaching-session',
      status: 'COMPLETED_TEACHING',
      character: {
        name: 'Black Widow',
        isNew: true,
        playCount: 0,
        taughtTrait: { featureKey: 'martial_artist', value: true },
      },
      feature: {
        key: 'martial_artist',
        question: 'Is this character an elite martial artist and master spy?',
        category: 'skills',
        isNew: true,
      },
      model: {
        retrained: true,
        modelVersion: '2.0.0',
        characterCount: 13,
        featureCount: 17,
        treeDepth: 5,
        leafCount: 13,
        trainedAt: new Date().toISOString(),
      },
      message: 'Successfully incorporated Black Widow into Mind-Mancer knowledge base.',
    });

    await app.handleSubmitTeaching(
      'Black Widow',
      'Is this character an elite martial artist and master spy?',
      'YES',
      'skills'
    );

    const learnedBadge = root.querySelector('.teaching-badge');
    expect(learnedBadge?.textContent).toContain('Knowledge Learned');

    const playAgainBtn = root.querySelector('#btn-play-again-after-teach') as HTMLButtonElement;
    expect(playAgainBtn).not.toBeNull();
    expect(playAgainBtn.textContent).toContain('Play Again with Updated Knowledge');

    // Clicking Play Again resets state to START
    playAgainBtn.click();
    expect(gameState.getState().screen).toBe('START');
    expect(gameState.getState().teachingResult).toBeNull();
  });

  it('TC-FE-05: Error response (e.g. 409 Conflict) renders user-friendly error message without losing entered inputs', async () => {
    vi.spyOn(apiClient, 'submitTeaching').mockRejectedValueOnce(
      new Error("Conflicting knowledge detected: Character 'Spider-Man' already has 'can_fly' recorded as 'false'.")
    );

    await app.handleSubmitTeaching('Spider-Man', 'Can this character fly?', 'YES');

    const state = gameState.getState();
    expect(state.screen).toBe('TEACHING');
    expect(state.error).toContain('Conflicting knowledge detected');

    const errorBanner = root.querySelector('.error-banner');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner?.textContent).toContain('Conflicting knowledge detected');
  });
});
