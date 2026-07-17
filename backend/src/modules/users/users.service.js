const repository = require('./users.repository');

/**
 * Returns every team member in the caller's organization.
 * Powers the "assign to" picker on the front end.
 */
async function listMembers(organizationId) {
  return repository.findAll(organizationId);
}

module.exports = { listMembers };
