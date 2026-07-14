const repository = require('./users.repository');

/**
 * Returns every team member in the (single, shared) workspace.
 * Powers the "assign to" picker on the front end.
 */
async function listMembers() {
  return repository.findAll();
}

module.exports = { listMembers };
