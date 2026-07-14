const { ApiError } = require('../../utils/ApiError');
const repository = require('./projects.repository');

function shapeProject(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    createdBy: { id: row.created_by_id ?? row.created_by, name: row.created_by_name },
  };
}

async function createProject({ name, createdBy }) {
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Project name is required');
  }
  const row = await repository.create({ name: name.trim(), createdBy });
  // re-fetch isn't needed for create since we already know who createdBy is,
  // but we don't have their name on hand here — list is the canonical shaped view.
  return { id: row.id, name: row.name, createdAt: row.created_at, createdBy: { id: createdBy } };
}

async function listProjects() {
  const rows = await repository.findAll();
  return rows.map(shapeProject);
}

/**
 * Used by other modules (e.g. tasks) to confirm a project exists before
 * acting on it. This is the one deliberate cross-module import in this
 * codebase — see README "Architecture" section for why that's OK here.
 */
async function getProjectOrThrow(id) {
  const project = await repository.findById(id);
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }
  return project;
}

module.exports = { createProject, listProjects, getProjectOrThrow };
