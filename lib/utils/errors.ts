/** Error with an HTTP status and a stable machine-readable code, safe to show to clients. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UniqueConstraintError extends AppError {
  constructor(constraint: string, message = "Record already exists") {
    super(409, "UNIQUE_VIOLATION", message, { constraint });
    this.name = "UniqueConstraintError";
  }
}

export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const badRequest = (message: string, details?: Record<string, unknown>) =>
  new AppError(400, "BAD_REQUEST", message, details);
