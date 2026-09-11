import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from '../src/ui/app';
import { gameState } from '../src/state/game.state';
import { apiClient } from '../src/api/api-client';
import fs from 'fs';
import path from 'path';

describe('Mind-Mancer Frontend Production Test Suite', () => {
  let root: HTMLElement;
  let app: App;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    gameState.reset();
    vi.restoreAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    vi.spyOn(apiClient, 'checkHealth').mockResolvedValue({
      status: 'healthy',
      service: 'mind-mancer-backend',
      database: 'connected',
      mlService: { status: 'connected', url: 'http://127.0.0.1:8000', details: null },
      timestamp: new Date().toISOString(),
    });
    app = new App(root);
  });

  it('1. start screen renders correctly', () => {
    const title = root.querySelector('.hero-title');
    const startBtn = root.querySelector('#btn-start-game');
    const steps = root.querySelectorAll('.instruction-step');

    expect(title?.textContent).toBe('Mind-Mancer');
    expect(startBtn).not.toBeNull();
    expect(startBtn?.textContent).toContain('Begin Mind Reading');
    expect(steps.length).toBe(3);
  });

  it('2. start button calls startGame()', async () => {
    const startSpy = vi.spyOn(apiClient, 'startGame').mockResolvedValueOnce({
      sessionId: 'test-session-123',
      status: 'ACTIVE',
      questionCount: 1,
      candidateCount: 12,
      question: {
        featureKey: 'can_fly',
        text: 'Can your character fly?',
        questionCount: 1,
      },
    });

    const startBtn = root.querySelector('#btn-start-game') as HTMLButtonElement;
    startBtn.click();

    expect(startSpy).toHaveBeenCalledTimes(1);

    // Wait for promise resolution
    await vi.waitFor(() => {
      expect(gameState.getState().screen).toBe('QUESTION');
    });
  });

  it('3. question text comes from API response', async () => {
    const customQuestionText = 'Does this entity wear an iron suit of armor?';
    vi.spyOn(apiClient, 'startGame').mockResolvedValueOnce({
      sessionId: 'session-iron-man',
      status: 'ACTIVE',
      questionCount: 1,
      candidateCount: 12,
      question: {
        featureKey: 'iron_armor',
        text: customQuestionText,
        questionCount: 1,
      },
    });

    await app.handleStartGame();

    const renderedText = root.querySelector('#current-question-text');
    expect(renderedText?.textContent).toBe(customQuestionText);
  });

  it('4. all five answer options render with correct labels and shortcut keys', async () => {
    vi.spyOn(apiClient, 'startGame').mockResolvedValueOnce({
      sessionId: 'session-answers',
      status: 'ACTIVE',
      questionCount: 1,
      candidateCount: 12,
      question: {
        featureKey: 'can_fly',
        text: 'Can your character fly?',
        questionCount: 1,
      },
    });

    await app.handleStartGame();

    const btnYes = root.querySelector('#btn-answer-yes');
    const btnProbably = root.querySelector('#btn-answer-probably');
    const btnDontKnow = root.querySelector('#btn-answer-dont_know');
    const btnProbablyNot = root.querySelector('#btn-answer-probably_not');
    const btnNo = root.querySelector('#btn-answer-no');

    expect(btnYes?.textContent).toContain('Yes');
    expect(btnProbably?.textContent).toContain('Probably');
    expect(btnDontKnow?.textContent).toContain("Don't Know");
    expect(btnProbablyNot?.textContent).toContain('Probably Not');
    expect(btnNo?.textContent).toContain('No');
  });

  it('5. clicking an answer sends the correct AnswerType', async () => {
    vi.spyOn(apiClient, 'startGame').mockResolvedValueOnce({
      sessionId: 'session-answer-type',
      status: 'ACTIVE',
      questionCount: 1,
      candidateCount: 12,
      question: {
        featureKey: 'can_fly',
        text: 'Can your character fly?',
        questionCount: 1,
      },
    });

    const answerSpy = vi.spyOn(apiClient, 'answerQuestion').mockResolvedValueOnce({
      sessionId: 'session-answer-type',
      status: 'ACTIVE',
      questionCount: 2,
      nextQuestion: {
        featureKey: 'has_cape',
        text: 'Does your character wear a cape?',
        questionCount: 2,
      },
    });

    await app.handleStartGame();

    const btnProbably = root.querySelector('#btn-answer-probably') as HTMLButtonElement;
    btnProbably.click();

    expect(answerSpy).toHaveBeenCalledWith('session-answer-type', 'PROBABLY');
  });

  it('6. duplicate answer submission is prevented while request is pending', async () => {
    vi.spyOn(apiClient, 'startGame').mockResolvedValueOnce({
      sessionId: 'session-duplicate',
      status: 'ACTIVE',
      questionCount: 1,
      candidateCount: 12,
      question: {
        featureKey: 'can_fly',
        text: 'Can your character fly?',
        questionCount: 1,
      },
    });

    let resolveAnswer: any;
    const pendingPromise = new Promise<any>((resolve) => {
      resolveAnswer = resolve;
    });

    const answerSpy = vi.spyOn(apiClient, 'answerQuestion').mockReturnValue(pendingPromise);

    await app.handleStartGame();

    const btnYes = root.querySelector('#btn-answer-yes') as HTMLButtonElement;

    // First click initiates request
    btnYes.click();
    expect(answerSpy).toHaveBeenCalledTimes(1);

    // Second rapid click while request is pending
    btnYes.click();
    expect(answerSpy).toHaveBeenCalledTimes(1); // Call count remains 1!

    // Direct invocation check
    await app.handleAnswer('YES');
    expect(answerSpy).toHaveBeenCalledTimes(1); // Still rejected by state guard!

    resolveAnswer({
      sessionId: 'session-duplicate',
      status: 'ACTIVE',
      questionCount: 2,
      nextQuestion: {
        featureKey: 'has_cape',
        text: 'Does wear cape?',
        questionCount: 2,
      },
    });
  });

  it('7. question count comes from backend state', async () => {
    vi.spyOn(apiClient, 'startGame').mockResolvedValueOnce({
      sessionId: 'session-qcount',
      status: 'ACTIVE',
      questionCount: 7,
      candidateCount: 12,
      question: {
        featureKey: 'is_human',
        text: 'Is your character human?',
        questionCount: 7,
      },
    });

    await app.handleStartGame();

    const progressLabel = root.querySelector('.progress-label');
    expect(progressLabel?.textContent).toBe('Question 7 of 20');
  });

  it('8. next question renders after successful answer', async () => {
    vi.spyOn(apiClient, 'startGame').mockResolvedValueOnce({
      sessionId: 'session-next-q',
      status: 'ACTIVE',
      questionCount: 1,
      candidateCount: 12,
      question: {
        featureKey: 'can_fly',
        text: 'Can your character fly?',
        questionCount: 1,
      },
    });

    vi.spyOn(apiClient, 'answerQuestion').mockResolvedValueOnce({
      sessionId: 'session-next-q',
      status: 'ACTIVE',
      questionCount: 2,
      nextQuestion: {
        featureKey: 'is_detective',
        text: 'Is your character a master detective?',
        questionCount: 2,
      },
    });

    await app.handleStartGame();
    await app.handleAnswer('NO');

    const renderedText = root.querySelector('#current-question-text');
    expect(renderedText?.textContent).toBe('Is your character a master detective?');
    expect(gameState.getState().questionCount).toBe(2);
  });

  it('9. DOMINANT_THRESHOLD result renders correctly with confident criteria', async () => {
    gameState.setState({
      screen: 'GUESS',
      sessionId: 'session-dominant',
      status: 'GUESSED',
      terminalReason: 'DOMINANT_THRESHOLD',
      questionCount: 6,
      guess: {
        name: 'Batman',
        relativeScore: 0.945,
        reason: 'DOMINANT_THRESHOLD',
      },
    });

    const charName = root.querySelector('#guessed-character-name');
    const badge = root.querySelector('.guess-badge');
    const reasonDesc = root.querySelector('.reason-desc');

    expect(charName?.textContent).toBe('Batman');
    expect(badge?.textContent).toContain('Dominant Confidence');
    expect(reasonDesc?.textContent).toContain('>= 65% with significant separation');
  });

  it('10. MAX_QUESTIONS result does NOT claim dominant confidence', async () => {
    gameState.setState({
      screen: 'GUESS',
      sessionId: 'session-max-q',
      status: 'GUESSED',
      terminalReason: 'MAX_QUESTIONS',
      questionCount: 20,
      guess: {
        name: 'Iron Man',
        relativeScore: 0.38,
        reason: 'MAX_QUESTIONS',
      },
    });

    const badge = root.querySelector('.guess-badge');
    const reasonDesc = root.querySelector('.reason-desc');

    expect(badge?.textContent).toContain('20 Questions Reached');
    expect(badge?.textContent).not.toContain('Dominant Confidence');
    expect(reasonDesc?.textContent).toContain('without reaching dominant threshold');
  });

  it('11. EXHAUSTED result renders correctly without claiming dominant confidence', async () => {
    gameState.setState({
      screen: 'GUESS',
      sessionId: 'session-exhausted',
      status: 'EXHAUSTED',
      terminalReason: 'EXHAUSTED',
      questionCount: 5,
      guess: {
        name: 'Spider-Man',
        relativeScore: 0.42,
        reason: 'EXHAUSTED',
      },
    });

    const badge = root.querySelector('.guess-badge');
    const reasonDesc = root.querySelector('.reason-desc');

    expect(badge?.textContent).toContain('Questions Exhausted');
    expect(reasonDesc?.textContent).toContain('All distinguishing questions exhausted');
  });

  it('12. TRIVIAL_KNOWLEDGE_BASE renders correctly for single-character database', async () => {
    gameState.setState({
      screen: 'GUESS',
      sessionId: 'session-trivial',
      status: 'GUESSED',
      terminalReason: 'TRIVIAL_KNOWLEDGE_BASE',
      questionCount: 0,
      guess: {
        name: 'SoleCharacter',
        relativeScore: 1.0,
        reason: 'TRIVIAL_KNOWLEDGE_BASE',
      },
    });

    const badge = root.querySelector('.guess-badge');
    const reasonDesc = root.querySelector('.reason-desc');

    expect(badge?.textContent).toContain('Sole Candidate');
    expect(reasonDesc?.textContent).toContain('Only one candidate exists');
  });

  it('13. Play Again starts a fresh game and resets state', () => {
    gameState.setState({
      screen: 'CELEBRATION',
      sessionId: 'old-session-456',
      questionCount: 15,
      guess: {
        name: 'Thor',
        relativeScore: 0.98,
        reason: 'DOMINANT_THRESHOLD',
      },
    });

    app.handleRestart();

    const state = gameState.getState();
    expect(state.screen).toBe('START');
    expect(state.sessionId).toBeNull();
    expect(state.questionCount).toBe(0);
    expect(state.guess).toBeNull();

    // Start screen is mounted
    const startBtn = root.querySelector('#btn-start-game');
    expect(startBtn).not.toBeNull();
  });

  it('14. API failure displays recovery UI error banner', async () => {
    vi.spyOn(apiClient, 'startGame').mockRejectedValueOnce(
      new Error('Unable to connect to Mind-Mancer server at http://127.0.0.1:3000.')
    );

    await app.handleStartGame();

    const errorBanner = root.querySelector('.error-banner');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner?.textContent).toContain('Unable to connect');
  });

  it('15. expired/unknown session displays recovery UI', async () => {
    gameState.setState({
      screen: 'QUESTION',
      sessionId: 'expired-session-id',
      status: 'ACTIVE',
      currentQuestion: { featureKey: 'can_fly', text: 'Can fly?', questionCount: 1 },
      loading: false,
    });

    vi.spyOn(apiClient, 'answerQuestion').mockRejectedValueOnce(
      new Error("Session 'expired-session-id' not found or has expired.")
    );

    await app.handleAnswer('YES');

    const errorBanner = root.querySelector('.error-banner');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner?.textContent).toContain('expired');
  });

  it('16. teaching state uses the actual Phase 5C backend contract', async () => {
    gameState.setState({
      screen: 'GUESS',
      sessionId: 'session-teach-test',
      status: 'GUESSED',
      guess: { name: 'Batman', relativeScore: 0.7, reason: 'DOMINANT_THRESHOLD' },
    });

    const teachSpy = vi.spyOn(apiClient, 'transitionToTeaching').mockResolvedValueOnce({
      sessionId: 'session-teach-test',
      status: 'TEACHING',
      message: 'Handoff to teaching mode initiated.',
    });

    await app.handleRejectGuess();

    expect(teachSpy).toHaveBeenCalledWith('session-teach-test');
    expect(gameState.getState().screen).toBe('TEACHING');

    const teachingHeader = root.querySelector('.teaching-header');
    expect(teachingHeader?.textContent).toContain('Mind-Mancer was stumped');
  });

  it('17. keyboard shortcuts trigger the correct answer', async () => {
    vi.spyOn(apiClient, 'startGame').mockResolvedValueOnce({
      sessionId: 'session-shortcuts',
      status: 'ACTIVE',
      questionCount: 1,
      candidateCount: 12,
      question: { featureKey: 'can_fly', text: 'Can fly?', questionCount: 1 },
    });

    const answerSpy = vi.spyOn(apiClient, 'answerQuestion').mockResolvedValue({
      sessionId: 'session-shortcuts',
      status: 'ACTIVE',
      questionCount: 2,
      nextQuestion: { featureKey: 'has_cape', text: 'Has cape?', questionCount: 2 },
    });

    await app.handleStartGame();

    // Simulate pressing '1' (YES)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(answerSpy).toHaveBeenCalledWith('session-shortcuts', 'YES');

    // Wait for the async answer to complete and reset loading to false
    await vi.waitFor(() => {
      expect(gameState.getState().loading).toBe(false);
    });

    // Simulate pressing '5' (NO)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
    expect(answerSpy).toHaveBeenCalledWith('session-shortcuts', 'NO');
  });

  it('18. frontend source contains no hardcoded game question dictionary', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];

    const forbiddenPatterns = [
      /const\s+questions\s*=\s*\[/i,
      /const\s+QUESTIONS\s*=\s*\[/i,
      /const\s+questionDictionary\s*=/i,
      /Can your character fly\?/i,
      /Is your character human\?/i,
    ];

    files.forEach((file) => {
      const fullPath = path.join(srcDir, file);
      if (fs.statSync(fullPath).isFile() && (file.endsWith('.ts') || file.endsWith('.js'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        forbiddenPatterns.forEach((pattern) => {
          expect(content).not.toMatch(pattern);
        });
      }
    });
  });
});
