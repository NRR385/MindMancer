import { config } from '../config/env';

export interface MLNextQuestionResponse {
  featureKey: string | null;
  status: string;
  diagnostics?: {
    featureKey: string;
    entropy: number;
    unknownRate: number;
    distinguishingRatio: number;
    treeImportance: number;
    utility: number;
  };
}

export interface MLRetrainResponse {
  success: boolean;
  status: string;
  character_count: number;
  feature_count: number;
  tree_depth?: number;
  leaf_count?: number;
  trained_at?: string;
  message?: string;
}

export class MLClientService {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl = config.mlServiceUrl, timeoutMs = 2000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Calls Python ML microservice to get guidance on the next best distinguishing feature.
   * Returns null if service is unreachable or errors, triggering Node's deterministic fallback.
   */
  public async getNextQuestion(
    candidateNames: string[],
    askedFeatures: string[]
  ): Promise<MLNextQuestionResponse | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/next-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateNames,
          askedFeatures,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[MLClient] Python ML returned status ${response.status}`);
        return null;
      }

      const data = (await response.json()) as MLNextQuestionResponse;
      return data;
    } catch (error) {
      // Network error, timeout, or service offline -> gracefully fall back to Node logic
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Dispatches a retrain request to the Python ML microservice.
   * Python loads canonical collections directly from MongoDB.
   */
  public async triggerRetrain(timeoutMs = 5000): Promise<MLRetrainResponse | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/retrain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[MLClient] Python /retrain returned status ${response.status}`);
        return null;
      }

      const data = (await response.json()) as MLRetrainResponse;
      return data;
    } catch (error) {
      console.warn(`[MLClient] Python /retrain request failed:`, error);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const mlClientService = new MLClientService();
