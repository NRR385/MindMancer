/**
 * Core Domain Types and Contracts for Mind-Mancer Game Engine.
 */

export type GameStatus = 'ACTIVE' | 'GUESSED' | 'EXHAUSTED' | 'TEACHING' | 'COMPLETED_TEACHING' | 'FAILED';

export type TerminalReason =
  | 'DOMINANT_THRESHOLD'
  | 'MAX_QUESTIONS'
  | 'EXHAUSTED'
  | 'TRIVIAL_KNOWLEDGE_BASE';

export type AnswerType = 'YES' | 'PROBABLY' | 'DONT_KNOW' | 'PROBABLY_NOT' | 'NO';

export const VALID_ANSWERS: readonly AnswerType[] = [
  'YES',
  'PROBABLY',
  'DONT_KNOW',
  'PROBABLY_NOT',
  'NO',
] as const;

export interface ICandidateState {
  name: string;
  score: number;
  playCount: number;
  traits: Record<string, boolean | undefined>;
}

export interface IGameSession {
  sessionId: string;
  candidates: ICandidateState[];
  askedFeatures: string[];
  questionCount: number;
  currentFeatureKey: string | null;
  status: GameStatus;
  terminalReason?: TerminalReason;
  bestGuess: { name: string; score: number; reason: TerminalReason } | null;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface IAnswerGameRequest {
  sessionId: string;
  answer: AnswerType;
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
