import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface RequestWithId extends Request {
  id: string;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestWithId = req as RequestWithId;
  // Generate unique request ID
  requestWithId.id = uuidv4();
  res.locals.requestId = requestWithId.id;

  // Log request details
  const startTime = Date.now();

  logger.info('Incoming request', {
    requestId: requestWithId.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      requestId: requestWithId.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
    });
  });

  next();
};
