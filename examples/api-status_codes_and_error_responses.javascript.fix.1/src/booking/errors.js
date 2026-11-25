export class AppError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class ValidationError extends AppError {}

export class ConflictError extends ValidationError {
  constructor(message, details = {}) {
    super(message, details);
    this.code = "seat_taken";
  }
}

export class NotFoundError extends AppError {}
