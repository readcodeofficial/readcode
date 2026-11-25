import { ConflictError, NotFoundError, ValidationError } from "./errors.js";

export function toHttpError(err) {
  if (err instanceof ValidationError) {
    return {
      status: 422,
      body: { error: { code: "invalid_request", message: err.message, details: err.details } },
    };
  }
  if (err instanceof ConflictError) {
    return {
      status: 409,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    };
  }
  if (err instanceof NotFoundError) {
    return { status: 404, body: { error: { code: "not_found", message: err.message } } };
  }
  if (err instanceof SyntaxError) {
    return { status: 400, body: { error: { code: "malformed_json", message: "request body is not valid JSON" } } };
  }
  return { status: 500, body: { error: { code: "internal", message: "internal error" } } };
}
