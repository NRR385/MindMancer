import { apiClient } from '../api/api-client';
import { gameState, GameState } from '../state/game.state';
import { AnswerType } from '../types/game.types';
import { renderStartScreen } from './start-screen';
import { renderGameScreen } from './game-screen';
import { renderGuessScreen } from './guess-screen';
import { renderTeachingScreen } from './teaching-screen';
import { renderCelebrationScreen } from './celebration-screen';
import { renderErrorBanner, renderLoadingOverlay } from './status-message';

export class App {
  private rootElement: HTMLElement;

  constructor(rootElement: HTMLElement) {
    this.rootElement = rootElement;
    this.initKeyboardListeners();
    gameState.subscribe((state) => this.render(state));
  }

  /**
   * Global keyboard shortcut listener.
   */
  private initKeyboardListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const state = gameState.getState();
      // Only capture keyboard shortcuts when active question screen is presented and not loading
      if (state.screen !== 'QUESTION' || state.loading || !state.sessionId) {
        return;
      }

      // Ignore keystrokes inside input or textarea elements
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === '1' || key === 'y') {
        e.preventDefault();
        this.handleAnswer('YES');
      } else if (key === '2') {
        e.preventDefault();
        this.handleAnswer('PROBABLY');
      } else if (key === '3' || key === 'd') {
        e.preventDefault();
        this.handleAnswer('DONT_KNOW');
      } else if (key === '4') {
        e.preventDefault();
        this.handleAnswer('PROBABLY_NOT');
      } else if (key === '5' || key === 'n') {
        e.preventDefault();
        this.handleAnswer('NO');
      }
    });
  }

  /**
   * Action: Start a new game session.
   */
  public async handleStartGame(): Promise<void> {
    gameState.setState({
      loading: true,
      loadingMessage: 'Consulting the Oracle...',
      error: null,
    });

    try {
      const res = await apiClient.startGame();

      if (res.status === 'GUESSED' && res.guess) {
        // Trivial 1-candidate knowledge base edge case
        gameState.setState({
          screen: 'GUESS',
          sessionId: res.sessionId,
          status: 'GUESSED',
          terminalReason: res.terminalReason || 'TRIVIAL_KNOWLEDGE_BASE',
          questionCount: 0,
          candidateCount: res.candidateCount,
          guess: res.guess,
          loading: false,
          loadingMessage: null,
        });
        return;
      }

      if (!res.question) {
        throw new Error('No initial question provided by server.');
      }

      gameState.setState({
        screen: 'QUESTION',
        sessionId: res.sessionId,
        status: 'ACTIVE',
        currentQuestion: res.question,
        questionCount: res.questionCount || res.question.questionCount || 1,
        candidateCount: res.candidateCount,
        loading: false,
        loadingMessage: null,
      });
    } catch (err: any) {
      gameState.setState({
        loading: false,
        loadingMessage: null,
        error: err.message || 'Failed to start game session.',
      });
    }
  }

  /**
   * Action: Submit an answer for the current question.
   */
  public async handleAnswer(answer: AnswerType): Promise<void> {
    const { sessionId, loading } = gameState.getState();
    if (!sessionId || loading) return;

    gameState.setState({
      loading: true,
      loadingMessage: 'Analyzing evidence matrix...',
      error: null,
    });

    try {
      const res = await apiClient.answerQuestion(sessionId, answer);

      // Terminal state: Guess or Exhaustion
      if ((res.status === 'GUESSED' || res.status === 'EXHAUSTED') && res.guess) {
        // Fetch top candidates diagnostics
        let topCandidates: Array<{ name: string; relativeScore: number }> = [];
        try {
          const guessData = await apiClient.getGuess(sessionId);
          topCandidates = guessData.topCandidates || [];
        } catch {
          // Non-blocking if diagnostics fetch fails
        }

        gameState.setState({
          screen: 'GUESS',
          status: res.status,
          terminalReason: res.terminalReason || 'DOMINANT_THRESHOLD',
          questionCount: res.questionCount,
          guess: res.guess,
          topCandidates,
          currentQuestion: null,
          loading: false,
          loadingMessage: null,
        });
        return;
      }

      // Next Question
      if (res.nextQuestion) {
        gameState.setState({
          screen: 'QUESTION',
          status: 'ACTIVE',
          currentQuestion: res.nextQuestion,
          questionCount: res.questionCount,
          loading: false,
          loadingMessage: null,
        });
        return;
      }

      throw new Error('Unexpected response state from server.');
    } catch (err: any) {
      gameState.setState({
        loading: false,
        loadingMessage: null,
        error: err.message || 'Failed to process answer.',
      });
    }
  }

  /**
   * Action: User confirmed guess was correct!
   */
  public handleConfirmCorrect(): void {
    gameState.setState({
      screen: 'CELEBRATION',
    });
  }

  /**
   * Action: User rejected guess (transition to teaching).
   */
  public async handleRejectGuess(): Promise<void> {
    const { sessionId } = gameState.getState();
    if (sessionId) {
      try {
        await apiClient.transitionToTeaching(sessionId);
      } catch {
        // Continue to teaching screen even if network transition fails
      }
    }

    gameState.setState({
      screen: 'TEACHING',
    });
  }

  /**
   * Action: User submitted teaching form.
   */
  public async handleSubmitTeaching(
    charName: string,
    question: string,
    answer: 'YES' | 'NO',
    category?: string
  ): Promise<void> {
    const { sessionId } = gameState.getState();
    if (!sessionId) {
      gameState.setState({
        error: 'No active session found for teaching handoff.',
      });
      return;
    }

    gameState.setState({
      loading: true,
      loadingMessage: 'Persisting knowledge & retraining model...',
      error: null,
    });

    try {
      const result = await apiClient.submitTeaching(sessionId, {
        characterName: charName,
        featureQuestion: question,
        featureCategory: category || 'skills',
        traitValue: answer === 'YES',
      });

      gameState.setState({
        loading: false,
        loadingMessage: null,
        error: null,
        teachingResult: result,
      });
    } catch (err: any) {
      gameState.setState({
        loading: false,
        loadingMessage: null,
        error: err.message || 'Failed to submit teaching knowledge.',
      });
    }
  }

  /**
   * Action: Reset to start screen.
   */
  public handleRestart(): void {
    gameState.reset();
  }

  /**
   * Re-renders the DOM view based on current state.
   */
  public render(state: GameState): void {
    this.rootElement.innerHTML = '';

    // Error Banner (if any)
    if (state.error && state.screen !== 'TEACHING') {
      const banner = renderErrorBanner(state.error, () => {
        gameState.setState({ error: null });
      });
      this.rootElement.appendChild(banner);
    }

    // View Container
    const viewContainer = document.createElement('main');
    viewContainer.className = 'app-view-container';

    switch (state.screen) {
      case 'START':
        viewContainer.appendChild(
          renderStartScreen({
            onStartGame: () => this.handleStartGame(),
            isLoading: state.loading,
          })
        );
        break;

      case 'QUESTION':
        if (state.currentQuestion) {
          viewContainer.appendChild(
            renderGameScreen({
              question: state.currentQuestion,
              questionCount: state.questionCount,
              isLoading: state.loading,
              onAnswer: (ans) => this.handleAnswer(ans),
              onRestart: () => this.handleRestart(),
            })
          );
        }
        break;

      case 'GUESS':
        if (state.guess) {
          viewContainer.appendChild(
            renderGuessScreen({
              guess: state.guess,
              questionCount: state.questionCount,
              topCandidates: state.topCandidates,
              onConfirmCorrect: () => this.handleConfirmCorrect(),
              onRejectGuess: () => this.handleRejectGuess(),
            })
          );
        }
        break;

      case 'TEACHING':
        viewContainer.appendChild(
          renderTeachingScreen({
            wrongGuessName: state.guess?.name || 'the entity',
            onSubmitTeaching: (name, q, ans, cat) => this.handleSubmitTeaching(name, q, ans, cat),
            onPlayAgain: () => this.handleRestart(),
            isLoading: state.loading,
            errorMessage: state.error,
            successResult: state.teachingResult,
          })
        );
        break;

      case 'CELEBRATION':
        viewContainer.appendChild(
          renderCelebrationScreen({
            characterName: state.guess?.name || 'your character',
            questionCount: state.questionCount,
            onPlayAgain: () => this.handleRestart(),
          })
        );
        break;
    }

    this.rootElement.appendChild(viewContainer);

    // Global loading spinner overlay
    if (state.loading && state.loadingMessage) {
      const overlay = renderLoadingOverlay(state.loadingMessage);
      this.rootElement.appendChild(overlay);
    }
  }
}
