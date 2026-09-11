import { config } from '../config';
import {
  IStartGameResponse,
  IAnswerGameResponse,
  IGuessResponse,
  IBackendHealthResponse,
  ITeachGameRequest,
  ITeachGameResponse,
  AnswerType,
} from '../types/game.types';

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = config.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // Non-JSON response (e.g. proxy HTML error page)
        data = null;
      }

      if (!response.ok) {
        const errorMsg =
          data?.error?.message ||
          data?.error ||
          `Server returned status ${response.status} (${response.statusText || 'Error'})`;
        throw new Error(errorMsg);
      }

      return data as T;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(`Unable to connect to Mind-Mancer server at ${this.baseUrl}. Is the backend running?`);
      }
      throw err;
    }
  }

  /**
   * Fast liveness probe for backend.
   */
  public async checkHealth(): Promise<IBackendHealthResponse> {
    return this.request<IBackendHealthResponse>('/api/health');
  }

  /**
   * Deep readiness probe verifying database and ML service dependencies.
   */
  public async checkReadiness(): Promise<any> {
    return this.request<any>('/api/health/ready');
  }

  /**
   * Starts a new game session.
   */
  public async startGame(): Promise<IStartGameResponse> {
    return this.request<IStartGameResponse>('/api/game/start', {
      method: 'POST',
    });
  }

  /**
   * Submits an answer for the current session question.
   */
  public async answerQuestion(
    sessionId: string,
    answer: AnswerType
  ): Promise<IAnswerGameResponse> {
    return this.request<IAnswerGameResponse>('/api/game/answer', {
      method: 'POST',
      body: JSON.stringify({ sessionId, answer }),
    });
  }

  /**
   * Retrieves the current top guess and relative candidates.
   */
  public async getGuess(sessionId: string): Promise<IGuessResponse> {
    return this.request<IGuessResponse>(`/api/game/guess/${sessionId}`);
  }

  /**
   * Transitions session into TEACHING mode when user indicates wrong guess.
   */
  public async transitionToTeaching(
    sessionId: string
  ): Promise<{ sessionId: string; status: string; message: string }> {
    return this.request<{ sessionId: string; status: string; message: string }>(
      `/api/game/teach/${sessionId}`,
      { method: 'POST' }
    );
  }

  /**
   * Submits knowledge teaching payload to persist Character/Feature and retrain ML model.
   */
  public async submitTeaching(
    sessionId: string,
    payload: ITeachGameRequest
  ): Promise<ITeachGameResponse> {
    return this.request<ITeachGameResponse>(`/api/game/teach/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const apiClient = new ApiClient();
