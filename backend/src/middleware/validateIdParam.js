const { ApiError } = require('../utils/ApiError');

/**
 * Validates that req.params[paramName] is a positive integer, and normalizes
 * it from a string to a Number in place so downstream code never re-parses it.
 */
function validateIdParam(paramName) {
  return (req, res, next) => {
    const value = Number(req.params[paramName]);
    if (!Number.isInteger(value) || value <= 0) {
      return next(new ApiError(400, `Invalid ${paramName}`));
    }
    req.params[paramName] = value;
    return next();
  };
}

module.exports = { validateIdParam };
