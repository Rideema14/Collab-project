const tasksService = require('../modules/tasks/tasks.service');
const mailer = require('../utils/email');

function daysOverdue(dueDate) {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  return Math.max(1, Math.round(diffMs / 86400000));
}

function buildBody(tasks) {
  const lines = tasks.map((t) => `- ${t.title} (${t.projectName}) — ${daysOverdue(t.dueDate)} day(s) overdue`);
  return `You have ${tasks.length} overdue task${tasks.length === 1 ? '' : 's'}:\n\n${lines.join('\n')}`;
}

/**
 * Emails every assignee with at least one overdue task a daily digest.
 * Runs on a schedule (see server.js) — not exposed as an HTTP route.
 */
async function sendOverdueReminders() {
  const groups = await tasksService.getOverdueTasksByAssignee();
  await Promise.all(
    groups.map(({ assignee, tasks }) =>
      mailer
        .send({
          to: assignee.email,
          subject: `You have ${tasks.length} overdue task${tasks.length === 1 ? '' : 's'}`,
          body: buildBody(tasks),
        })
        .catch((err) => console.error(`[overdueReminders] failed to email ${assignee.email}:`, err))
    )
  );
  return { assigneesNotified: groups.length, taskCount: groups.reduce((n, g) => n + g.tasks.length, 0) };
}

module.exports = { sendOverdueReminders };
