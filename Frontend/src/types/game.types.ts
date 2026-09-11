/**
 * Frontend Domain and API Types for Mind-Mancer.
 * Mirrors Node backend contract.
 */

export type GameStatus = 'ACTIVE' | 'GUESSED' | 'EXHAUSTED' | 'TEACHING' | 'FAILED';

export type TerminalReason =
  | 'DOMINANT_THRESHOLD'
  | 'MAX_QUESTIONS'
  | 'EXHAUSTED'
  | 'TRIVIAL_KNOWLEDGE_BASE';

export type AnswerType = 'YES' | 'PROBABLY' | 'DONT_KNOW' | 'PROBABLY_NOT' | 'NO';

export interface IQuestionPayload {
  featureKey: string;
  text: string;
  questionCount: number;
}

export interface IStartGameResponse {
  sessionId: string;
  status: GameStatus;
  questionCount: number;
  candidateCount: number;
  terminalReason?: TerminalReason;
  question?: IQuestionPayload;
  guess?: {
    name: string;
    relativeScore: number;
    reason: TerminalReason;
  };
  message?: string;
}

export interface IAnswerGameResponse {
  sessionId: string;
  status: GameStatus;
  questionCount: number;
  terminalReason?: TerminalReason;
  nextQuestion?: IQuestionPayload;
  guess?: {
    name: string;
    relativeScore: number;
    reason: TerminalReason;
  };
  message?: string;
}

export interface IGuessResponse {
  sessionId: string;
  status: GameStatus;
  questionCount: number;
  terminalReason?: TerminalReason;
  guess: {
    name: string;
    relativeScore: number;
    reason: TerminalReason;
  } | null;
  topCandidates: Array<{
    name: string;
    relativeScore: number;
  }>;
}

export interface IBackendHealthResponse {
  status: string;
  service: string;
  database: string;
  mlService: {
    status: string;
    url: string;
    details?: {
      status: string;
      modelLoaded: boolean;
      characterCount: number;
    } | null;
  };
  timestamp: string;
}

export interface ITeachGameRequest {
  characterName: string;
  featureKey?: string;
  featureQuestion?: string;
  featureCategory?: string;
  traitValue: boolean;
}

export interface ITeachModelMetadata {
  retrained: boolean;
  modelVersion?: string;
  characterCount?: number;
  featureCount?: number;
  treeDepth?: number;
  leafCount?: number;
  trainedAt?: string;
  status?: string;
  warning?: string;
}

export interface ITeachGameResponse {
  success: boolean;
  sessionId: string;
  status: GameStatus;
  character: {
    name: string;
    isNew: boolean;
    playCount: number;
    taughtTrait: {
      featureKey: string;
      value: boolean;
    };
  };
  feature: {
    key: string;
    question: string;
    category: string;
    isNew: boolean;
  };
  model: ITeachModelMetadata;
  message: string;
}
