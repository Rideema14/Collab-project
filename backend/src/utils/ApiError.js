/**
 * A typed error carrying an HTTP status code.
 * Services/controllers throw this for expected failures (validation, not found,
 * conflict, etc.) so the error middleware can turn it into a clean JSON response
 * instead of a generic 500.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

module.exports = { ApiError };
