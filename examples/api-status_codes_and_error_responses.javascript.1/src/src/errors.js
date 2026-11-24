'use strict';

class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const notFound = (what) => new AppError(404, 'not_found', `${what} not found`);
const conflict = (message) => new AppError(409, 'conflict', message);
const badRequest = (details) => new AppError(400, 'invalid_request', 'Request validation failed', details);

function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'invalid_json', message: 'Body is not valid JSON' });
    }
    logger.error({ err, path: req.path, requestId: req.id }, 'unhandled error');
    return res.status(500).json({ error: 'internal_error', message: 'Unexpected error' });
  };
}

module.exports = { AppError, notFound, conflict, badRequest, errorHandler };
