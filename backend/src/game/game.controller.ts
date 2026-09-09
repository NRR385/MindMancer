import { Request, Response, NextFunction } from 'express';
import { gameService } from './game.service';
import { AnswerType } from './game.types';

export async function handleStartGame(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await gameService.startGame();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleAnswerQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId, answer } = req.body as { sessionId: string; answer: AnswerType };

    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'Missing sessionId in request body',
        },
      });
      return;
    }

    if (!answer) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ANSWER_TYPE',
          message: 'Missing answer in request body',
        },
      });
      return;
    }

    const result = await gameService.answerQuestion(sessionId, answer);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function handleGetGuess(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'Missing sessionId parameter',
        },
      });
      return;
    }

    const result = gameService.getGuess(sessionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleTeach(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'Missing sessionId parameter',
        },
      });
      return;
    }

    // Determine if this is a teaching payload submission or an empty transition signal
    const isExplicitPayload =
      req.body &&
      typeof req.body === 'object' &&
      (Object.keys(req.body).length > 0 || req.headers['content-type']?.includes('application/json'));

    if (isExplicitPayload && req.headers['content-length'] !== '0') {
      const result = await gameService.teachSession(sessionId, req.body);
      res.status(200).json(result);
      return;
    }

    // Fallback: transition signal with empty body
    const result = gameService.transitionToTeaching(sessionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
