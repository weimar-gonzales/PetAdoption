export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
    });
  }

  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: { code: 'IMAGE_TOO_LARGE', message: 'The image exceeds the maximum allowed size' } });
  }

  if (error?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: { code: 'INVALID_IMAGE_UPLOAD', message: 'Only one image file may be uploaded in the image field' } });
  }

  if (error?.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues.map(({ path, message }) => ({ path, message })),
      },
    });
  }

  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
  }

  if (error?.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'Referenced pet does not exist' } });
  }

  if (error?.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: { code: 'PET_HAS_ADOPTION_REQUESTS', message: 'Pet cannot be deleted while adoption requests exist' } });
  }

  const status = error instanceof AppError ? error.status : (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500);
  const body = {
    error: {
      code: error instanceof AppError || status < 500 ? (error.code ?? 'REQUEST_ERROR') : 'INTERNAL_ERROR',
      message: error instanceof AppError || status < 500 ? error.message : 'An unexpected error occurred',
    },
  };
  if (error instanceof AppError && error.details !== undefined) body.error.details = error.details;
  if (status >= 500) console.error(error);
  return res.status(status).json(body);
};
