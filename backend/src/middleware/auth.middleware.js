const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError } = require('../utils/ApiError');
const authRepository = require('../modules/auth/auth.repository');

/**
 * Short-lived per-user cache of the auth-state row (status + token_version). The
 * DB is remote, so without this every authenticated request pays a round trip
 * just to re-check the same thing — the dashboard alone fires several at once.
 * TTL is deliberately short: an admin force-logout / suspend takes effect within
 * AUTH_STATE_TTL_MS rather than instantly (the accepted trade-off for the speed).
 * A DB failure is NOT cached, so a transient error just re-queries next time.
 */
const AUTH_STATE_TTL_MS = 15000;
const authStateCache = new Map(); // userId -> { state, expires }

async function getAuthState(userId) {
  const cached = authStateCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.state;
  const state = await authRepository.findAuthStateById(userId);
  authStateCache.set(userId, { state, expires: Date.now() + AUTH_STATE_TTL_MS });
  return state;
}

/** Drop a user's cached auth-state so a force-logout/suspend can take effect at
 *  once instead of waiting out the TTL. Safe to call from admin actions. */
function invalidateAuthState(userId) {
  authStateCache.delete(userId);
}

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

  // 1) Verify the token itself. A malformed/expired/tampered token is a genuine
  //    401 — the client SHOULD drop the session and send the user to /login.
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return next(new ApiError(401, 'Invalid or expired token'));
  }

  // 2) Check live account state (suspension + remote force-logout). A failure
  //    HERE is a DB/network problem, NOT an auth failure. Returning 401 would
  //    sign the user out on a transient Supabase hiccup — the cause of the
  //    "randomly logged out after a while" bug. Surface it as 503 so the client
  //    keeps the session and just fails that one request.
  let authState;
  try {
    authState = await getAuthState(payload.sub);
  } catch {
    return next(new ApiError(503, 'Could not verify your session right now. Please try again.'));
  }

  if (!authState) return next(new ApiError(401, 'Invalid or expired token'));
  if (authState.status === 'suspended') return next(new ApiError(403, 'This account has been suspended'));
  if ((payload.tokenVersion ?? 0) !== authState.token_version) {
    return next(new ApiError(401, 'This session has been signed out remotely — please log in again'));
  }
  req.user = { id: payload.sub, name: payload.name, email: payload.email };
  return next();
}

module.exports = { requireAuth, invalidateAuthState };
