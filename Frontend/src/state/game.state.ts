import {
  GameStatus,
  TerminalReason,
  IQuestionPayload,
  ITeachGameResponse,
} from '../types/game.types';

export type ScreenType = 'START' | 'QUESTION' | 'GUESS' | 'TEACHING' | 'CELEBRATION';

export interface GameState {
  screen: ScreenType;
  sessionId: string | null;
  status: GameStatus;
  currentQuestion: IQuestionPayload | null;
  questionCount: number;
  candidateCount: number;
  guess: {
    name: string;
    relativeScore: number;
    reason: TerminalReason;
  } | null;
  terminalReason: TerminalReason | null;
  message: string | null;
  topCandidates: Array<{ name: string; relativeScore: number }>;
  loading: boolean;
  loadingMessage: string | null;
  error: string | null;
  teachingResult: ITeachGameResponse | null;
}

export type StateListener = (state: GameState) => void;

const initialState: GameState = {
  screen: 'START',
  sessionId: null,
  status: 'ACTIVE',
  currentQuestion: null,
  questionCount: 0,
  candidateCount: 0,
  guess: null,
  terminalReason: null,
  message: null,
  topCandidates: [],
  loading: false,
  loadingMessage: null,
  error: null,
  teachingResult: null,
};

export class GameStateManager {
  private state: GameState = { ...initialState };
  private listeners: Set<StateListener> = new Set();

  public getState(): GameState {
    return { ...this.state };
  }

  public setState(updates: Partial<GameState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };
    this.notify();
  }

  public reset(): void {
    this.state = { ...initialState };
    this.notify();
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[GameState] Listener error:', err);
      }
    });
  }
}

export const gameState = new GameStateManager();
