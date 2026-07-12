export class DomainError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFound(code: string, message: string, details?: Record<string, unknown>) {
  return new DomainError(404, code, message, details);
}

export function validationError(code: string, message: string, details?: Record<string, unknown>) {
  return new DomainError(422, code, message, details);
}

export function conflictError(code: string, message: string, details?: Record<string, unknown>) {
  return new DomainError(409, code, message, details);
}

export function authError(code: string, message: string, details?: Record<string, unknown>) {
  return new DomainError(401, code, message, details);
}
