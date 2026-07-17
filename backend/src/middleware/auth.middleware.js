const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError } = require('../utils/ApiError');
const authRepository = require('../modules/auth/auth.repository');

/**
 * Verifies the `Authorization: Bearer <token>` header, then checks the token's
 * embedded tokenVersion against the live users.token_version (an admin's
 * force-logout bumps this — instantly invalidates every token issued before
 * the bump, despite JWTs otherwise being stateless) and rejects suspended
 * accounts. Attaches `req.user = { id, name, email }` for downstream handlers.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or invalid Authorization header'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const authState = await authRepository.findAuthStateById(payload.sub);
    if (!authState) return next(new ApiError(401, 'Invalid or expired token'));
    if (authState.status === 'suspended') return next(new ApiError(403, 'This account has been suspended'));
    if ((payload.tokenVersion ?? 0) !== authState.token_version) {
      return next(new ApiError(401, 'This session has been signed out remotely — please log in again'));
    }
    req.user = { id: payload.sub, name: payload.name, email: payload.email };
    return next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = { requireAuth };
