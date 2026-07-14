const BASE = 'http://localhost:4000';
let passed = 0;
let failed = 0;

function check(label, condition, extra) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label} ${extra !== undefined ? '-> ' + JSON.stringify(extra) : ''}`);
  }
}

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  console.log('== Health check ==');
  {
    const res = await fetch(`${BASE}/api/health`);
    const text = await res.text();
    check('GET /api/health -> 200 "server working"', res.status === 200 && text === 'server working', text);
  }

  console.log('== Auth ==');
  const email = `priya.${Date.now()}@example.com`;
  let token;
  {
    const r = await call('POST', '/api/auth/register', { name: 'Priya Sharma', email, password: 'testpass123' });
    check('register -> 201 with token', r.status === 201 && !!r.json?.data?.token, r);
    token = r.json?.data?.token;
  }
  {
    const r = await call('POST', '/api/auth/register', { name: 'Priya Sharma', email, password: 'testpass123' });
    check('duplicate register -> 409', r.status === 409, r);
  }
  {
    const r = await call('POST', '/api/auth/login', { email, password: 'wrongpass' });
    check('login wrong password -> 401', r.status === 401, r);
  }
  {
    const r = await call('POST', '/api/auth/login', { email, password: 'testpass123' });
    check('login correct password -> 200 with token', r.status === 200 && !!r.json?.data?.token, r);
    token = r.json.data.token; // use the login-issued token from here on, like a real client would
  }

  console.log('== Users (team members / assignee picker) ==');
  {
    const r = await call('GET', '/api/users');
    check('list users without auth -> 401', r.status === 401, r);
  }
  let ashaId, benId;
  {
    const r = await call('GET', '/api/users', undefined, token);
    check('list users with auth -> 200 array', r.status === 200 && Array.isArray(r.json?.data), r);
    ashaId = r.json.data.find((u) => u.email === 'asha@example.com')?.id;
    benId = r.json.data.find((u) => u.email === 'ben@example.com')?.id;
    check('seeded demo users present', !!ashaId && !!benId, r.json?.data);
  }

  console.log('== Projects ==');
  {
    const r = await call('POST', '/api/projects', { name: '' }, token);
    check('create project blank name -> 400', r.status === 400, r);
  }
  let projectId;
  {
    const r = await call('POST', '/api/projects', { name: 'Website Relaunch' }, token);
    check('create project -> 201', r.status === 201 && r.json?.data?.id, r);
    projectId = r.json.data.id;
  }
  {
    const r = await call('GET', '/api/projects', undefined, token);
    const found = r.json?.data?.some((p) => p.id === projectId && p.name === 'Website Relaunch');
    check('list projects includes new project', r.status === 200 && found, r);
  }

  console.log('== Tasks ==');
  {
    const r = await call('POST', '/api/projects/999999/tasks', { title: 'X' }, token);
    check('create task on nonexistent project -> 404', r.status === 404, r);
  }
  {
    const r = await call('POST', `/api/projects/${projectId}/tasks`, { title: 'Bad assignee', assigneeId: 999999 }, token);
    check('create task with invalid assigneeId -> 400 (FK mapped)', r.status === 400, r);
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  let task1Id, task2Id;
  {
    const r = await call(
      'POST',
      `/api/projects/${projectId}/tasks`,
      { title: 'Design homepage mockup', assigneeId: ashaId, dueDate: yesterday },
      token
    );
    check('create task 1 -> 201, status To Do', r.status === 201 && r.json?.data?.status === 'To Do', r);
    check('overdue task flagged isOverdue=true', r.json?.data?.isOverdue === true, r);
    task1Id = r.json.data.id;
  }
  {
    const r = await call(
      'POST',
      `/api/projects/${projectId}/tasks`,
      { title: 'Write launch announcement', dueDate: nextWeek },
      token
    );
    check('create task 2 (no assignee) -> 201', r.status === 201 && r.json?.data?.assignee === null, r);
    check('future due date not overdue', r.json?.data?.isOverdue === false, r);
    task2Id = r.json.data.id;
  }
  {
    const r = await call('GET', `/api/projects/${projectId}/tasks`, undefined, token);
    const todo = r.json?.data?.['To Do'] || [];
    check('board groups both tasks under To Do', r.status === 200 && todo.length === 2, r);
  }
  {
    const r = await call('PATCH', `/api/tasks/${task1Id}/status`, { status: 'Blocked' }, token);
    check('invalid status value -> 400', r.status === 400, r);
  }
  {
    const r = await call('PATCH', `/api/tasks/${task1Id}/status`, { status: 'In Progress' }, token);
    check('drag task 1 to In Progress -> 200', r.status === 200 && r.json?.data?.status === 'In Progress', r);
  }
  {
    const r = await call('GET', `/api/projects/${projectId}/tasks`, undefined, token);
    const inProgress = r.json?.data?.['In Progress'] || [];
    const todo = r.json?.data?.['To Do'] || [];
    check(
      'board reflects the move after refetch (persisted)',
      inProgress.some((t) => t.id === task1Id) && todo.some((t) => t.id === task2Id) && todo.length === 1,
      r
    );
  }
  {
    const r = await call('PATCH', `/api/tasks/${task2Id}`, { title: '   ' }, token);
    check('edit task with blank title -> 400', r.status === 400, r);
  }
  {
    const r = await call('PATCH', `/api/tasks/${task2Id}`, { assigneeId: benId, title: 'Write & schedule announcement' }, token);
    check(
      'edit task title + assignee -> 200, reflected',
      r.status === 200 && r.json?.data?.assignee?.id === benId && r.json?.data?.title === 'Write & schedule announcement',
      r
    );
  }
  {
    const r = await call('DELETE', `/api/tasks/${task1Id}`, undefined, token);
    check('delete task 1 -> 204', r.status === 204, r);
  }
  {
    const r = await call('DELETE', `/api/tasks/${task1Id}`, undefined, token);
    check('delete already-deleted task -> 404', r.status === 404, r);
  }
  {
    const r = await call('GET', `/api/projects/${projectId}/tasks`, undefined, token);
    const all = [...(r.json?.data?.['To Do'] || []), ...(r.json?.data?.['In Progress'] || []), ...(r.json?.data?.Done || [])];
    check('board shows only task 2 after delete', all.length === 1 && all[0].id === task2Id, r);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Test script crashed:', err);
  process.exitCode = 1;
});
