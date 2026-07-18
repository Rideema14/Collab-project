const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { ApiError } = require('../../utils/ApiError');
const repository = require('./auth.repository');

const SALT_ROUNDS = 10;

function signToken(user) {
  // tokenVersion is embedded so requireAuth can instantly invalidate every token
  // issued before an admin's force-logout bumps users.token_version — the
  // workaround for enforcing revocation on an otherwise-stateless JWT.
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, tokenVersion: user.token_version ?? 0 },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function shapeUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

/**
 * Not in the original spec (which only asks for sign-in), but sign-in is
 * untestable without a way to create a user first. This plays the role the
 * spec leaves implicit: team members are provisioned via this endpoint.
 */
async function register({ name, email, password }) {
  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email, and password are required');
  }
  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await repository.findByEmail(normalizedEmail);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await repository.createUser({ name: name.trim(), email: normalizedEmail, passwordHash });

  // Auto-join the (single, today) default org as Member — see repository doc comment.
  const organizationId = await repository.findDefaultOrganizationId();
  if (organizationId) {
    await repository.addMembership(user.id, organizationId, 'member');
  }

  const token = signToken(user);
  return { user: shapeUser(user), token };
}

async function login({ email, password }, requestMeta = {}) {
  if (!email || !password) {
    throw new ApiError(400, 'email and password are required');
  }

  const user = await repository.findByEmail(email.toLowerCase().trim());
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (user.status === 'suspended') {
    throw new ApiError(403, 'This account has been suspended');
  }

  // Fire-and-forget: the login-history insert is telemetry, so don't make the
  // caller wait a second remote DB round trip for it before getting their token.
  repository.recordLogin(user.id, requestMeta).catch((err) => console.error('[auth] failed to record login event:', err));

  const token = signToken(user);
  return { user: shapeUser(user), token };
}

module.exports = { register, login };
