const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../utils/auditLog');
const repository = require('./projects.repository');

function shapeProject(row) {
  return {
    id: row.id,
    name: row.name,
    archived: row.archived ?? false,
    createdAt: row.created_at,
    createdBy: { id: row.created_by_id ?? row.created_by, name: row.created_by_name },
  };
}

async function createProject({ name, createdBy, organizationId }) {
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Project name is required');
  }
  const row = await repository.create({ name: name.trim(), createdBy, organizationId });
  logAudit({ organizationId, actorId: createdBy, action: 'project.create', targetType: 'project', targetId: row.id }).catch((err) =>
    console.error('[audit] failed to log project.create:', err)
  );
  // re-fetch isn't needed for create since we already know who createdBy is,
  // but we don't have their name on hand here — list is the canonical shaped view.
  return { id: row.id, name: row.name, createdAt: row.created_at, createdBy: { id: createdBy } };
}

async function listProjects(organizationId) {
  const rows = await repository.findAll(organizationId);
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

async function updateProject(id, fields, actorId) {
  const existing = await getProjectOrThrow(id);
  const updates = {};
  if (fields.name !== undefined) {
    if (!fields.name.trim()) throw new ApiError(400, 'Project name cannot be empty');
    updates.name = fields.name.trim();
  }
  if (fields.archived !== undefined) {
    updates.archived = Boolean(fields.archived);
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields provided to update');
  }
  const row = await repository.update(id, updates);
  logAudit({
    organizationId: existing.organization_id,
    actorId,
    action: updates.archived !== undefined ? (updates.archived ? 'project.archive' : 'project.restore') : 'project.edit',
    targetType: 'project',
    targetId: id,
  }).catch((err) => console.error('[audit] failed to log project update:', err));
  return shapeProject(row);
}

async function deleteProject(id, actorId) {
  const existing = await getProjectOrThrow(id);
  const deleted = await repository.remove(id);
  if (!deleted) throw new ApiError(404, 'Project not found');
  logAudit({ organizationId: existing.organization_id, actorId, action: 'project.delete', targetType: 'project', targetId: id }).catch(
    (err) => console.error('[audit] failed to log project.delete:', err)
  );
}

module.exports = { createProject, listProjects, getProjectOrThrow, updateProject, deleteProject };
