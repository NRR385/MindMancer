import { mlClientService, MLRetrainResponse } from './ml-client.service';

/**
 * In-memory serialized FIFO queue for Python ML retraining.
 * Guarantees that at most one POST /retrain executes concurrently.
 * Reads complete canonical MongoDB state during every execution.
 */
export class SerializedRetrainQueue {
  private isExecuting: boolean = false;
  private queue: Array<{
    resolve: (value: MLRetrainResponse | null) => void;
    reject: (reason: any) => void;
  }> = [];

  /**
   * Enqueues a retrain task and returns a promise resolving with the MLRetrainResponse or null.
   */
  public enqueue(): Promise<MLRetrainResponse | null> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isExecuting || this.queue.length === 0) {
      return;
    }

    this.isExecuting = true;
    const task = this.queue.shift()!;

    try {
      const result = await mlClientService.triggerRetrain();
      task.resolve(result);
    } catch (err) {
      task.reject(err);
    } finally {
      this.isExecuting = false;
      this.processNext();
    }
  }

  /**
   * Returns current queue depth (for diagnostics/testing).
   */
  public get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Returns whether a retrain job is currently executing.
   */
  public get executing(): boolean {
    return this.isExecuting;
  }
}

export const retrainQueue = new SerializedRetrainQueue();
