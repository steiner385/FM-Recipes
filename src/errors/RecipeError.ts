type RecipeErrorCode = 
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RECIPE_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'FAMILY_NOT_FOUND'
  | 'ITEM_NOT_FOUND'
  | 'INVALID_RATING'
  | 'INVALID_INGREDIENTS'
  | 'INVALID_DIFFICULTY'
  | 'INTERNAL_ERROR';

interface RecipeErrorParams {
  code: RecipeErrorCode;
  message: string;
  entity?: string;
  details?: unknown;
}

export class RecipeError extends Error {
  readonly code: RecipeErrorCode;
  readonly entity: string;
  readonly details?: unknown;
  readonly statusCode: number;

  constructor({ code, message, entity = 'RECIPE', details }: RecipeErrorParams) {
    super(message);
    this.name = 'RecipeError';
    this.code = code;
    this.entity = entity;
    this.details = details;

    // Map error codes to HTTP status codes
    this.statusCode = {
      'VALIDATION_ERROR': 400,
      'UNAUTHORIZED': 401,
      'FORBIDDEN': 403,
      'NOT_FOUND': 404,
      'RECIPE_NOT_FOUND': 404,
      'USER_NOT_FOUND': 404,
      'FAMILY_NOT_FOUND': 404,
      'ITEM_NOT_FOUND': 404,
      'INVALID_RATING': 400,
      'INVALID_INGREDIENTS': 400,
      'INVALID_DIFFICULTY': 400,
      'INTERNAL_ERROR': 500
    }[code];

    // Capture stack trace
    Error.captureStackTrace(this, RecipeError);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      entity: this.entity,
      details: this.details,
      statusCode: this.statusCode
    };
  }
}
