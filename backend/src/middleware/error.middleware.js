const { ApiError } = require('../utils/ApiError');

// Common PostgreSQL error codes worth turning into clean 4xx responses
// instead of leaking a raw 500 to the client.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_ERROR_MESSAGES = {
  '23505': 'A record with this value already exists',
  '23503': 'Referenced record does not exist',
  '22P02': 'Invalid input format',
  '22007': 'Invalid date/time format',
};

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, error: { message: err.message } });
  }

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, error: { message: 'Malformed JSON in request body' } });
  }

  if (err.code && PG_ERROR_MESSAGES[err.code]) {
    return res.status(err.code === '23505' ? 409 : 400).json({
      success: false,
      error: { message: PG_ERROR_MESSAGES[err.code] },
    });
  }

  console.error(err);
  return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
}

module.exports = { errorMiddleware };
