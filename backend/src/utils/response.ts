import { Response } from 'express';

export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
    field?: string;
    timestamp: string;
    path: string;
    method: string;
  };
  meta?: {
    pagination?: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
      nextPage?: number;
      prevPage?: number;
    };
  };
  requestId?: string;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage?: number;
  prevPage?: number;
}

export class ApiResponse {
  static success<T>(
    message?: string,
    data?: T,
    _statusCode: number = 200,
    meta?: IApiResponse['meta']
  ): IApiResponse<T> {
    return {
      success: true,
      data,
      message,
      meta,
    };
  }

  static error(
    message: string,
    _statusCode: number = 400,
    code: string = 'ERROR',
    details?: any
  ): IApiResponse {
    return {
      success: false,
      message,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: '',
        method: '',
      },
    };
  }
}

export class ResponseUtil {
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200,
    meta?: IApiResponse['meta']
  ): Response {
    const response: IApiResponse<T> = {
      success: true,
      data,
      message,
      meta,
    };

    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    code: string,
    message: string,
    statusCode: number = 400,
    details?: any,
    field?: string
  ): Response {
    const response: IApiResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        field,
        timestamp: new Date().toISOString(),
        path: res.req.path,
        method: res.req.method,
      },
      requestId: res.locals.requestId,
    };

    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T, message?: string): Response {
    return this.success(res, data, message, 201);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static badRequest(res: Response, message: string = 'Bad Request', details?: any): Response {
    return this.error(res, 'BAD_REQUEST', message, 400, details);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized'): Response {
    return this.error(res, 'UNAUTHORIZED', message, 401);
  }

  static forbidden(res: Response, message: string = 'Forbidden'): Response {
    return this.error(res, 'FORBIDDEN', message, 403);
  }

  static notFound(res: Response, message: string = 'Resource not found'): Response {
    return this.error(res, 'NOT_FOUND', message, 404);
  }

  static conflict(res: Response, message: string = 'Resource conflict'): Response {
    return this.error(res, 'CONFLICT', message, 409);
  }

  static validationError(
    res: Response,
    details: any,
    message: string = 'Validation failed'
  ): Response {
    return this.error(res, 'VALIDATION_ERROR', message, 422, details);
  }

  static tooManyRequests(res: Response, message: string = 'Too many requests'): Response {
    return this.error(res, 'RATE_LIMIT_EXCEEDED', message, 429);
  }

  static internalError(res: Response, message: string = 'Internal server error'): Response {
    return this.error(res, 'INTERNAL_ERROR', message, 500);
  }

  static createPaginationMeta(
    currentPage: number,
    totalItems: number,
    itemsPerPage: number
  ): PaginationMeta {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    return {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? currentPage + 1 : undefined,
      prevPage: hasPrevPage ? currentPage - 1 : undefined,
    };
  }
}
