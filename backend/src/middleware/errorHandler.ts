import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
  conflict?: unknown;
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Handle body-parser malformed JSON syntax error
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MALFORMED_JSON',
        message: 'Malformed JSON payload in request body.',
      },
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, mask raw 500 internal errors to avoid leaking driver/DB/system paths
  let message = err.message || 'Internal Server Error';
  if (statusCode === 500 && isProduction) {
    message = 'Internal server error.';
  }

  // Derive standard code if not explicitly set
  let code = err.code;
  if (!code) {
    if (statusCode === 400) code = 'BAD_REQUEST';
    else if (statusCode === 404) code = 'NOT_FOUND';
    else if (statusCode === 409) code = 'KNOWLEDGE_CONFLICT';
    else if (statusCode === 422) code = 'UNPROCESSABLE_ENTITY';
    else if (statusCode === 429) code = 'RATE_LIMIT_EXCEEDED';
    else code = 'INTERNAL_SERVER_ERROR';
  }

  console.error(`[Error] ${req.method} ${req.path} - Status: ${statusCode} Code: ${code}`, err.message || err);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.conflict ? { conflict: err.conflict } : {}),
      ...(!isProduction && { details: err.details, stack: err.stack }),
    },
  });
}
