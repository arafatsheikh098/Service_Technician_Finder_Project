import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.id;

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
      requestId,
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      requestId,
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: err.message }, requestId });
    return;
  }
  // Malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' }, requestId });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Body too large' }, requestId });
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
    requestId,
  });
};
