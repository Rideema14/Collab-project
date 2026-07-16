// Reproduces the Teams crash using a LEGACY org blob — the shape actually written
// by the previous build: roles/members/tags/audit, but NO `teams` key.
const { chromium } = require('playwright');
const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';

const legacyOrg = (uid) => ({
  roles: [
    { id: 'role-owner', name: 'Owner', color: '#7c3aed', system: true,
      permissions: ['task.create', 'task.edit', 'task.delete', 'status.manage', 'member.manage', 'space.manage', 'settings.manage'] },
    { id: 'role-admin', name: 'Admin', color: '#2563eb', system: true,
      permissions: ['task.create', 'task.edit', 'task.delete', 'status.manage', 'member.manage', 'space.manage'] },
    { id: 'role-member', name: 'Member', color: '#16a34a', system: true, permissions: ['task.create', 'task.edit', 'task.delete'] },
    { id: 'role-guest', name: 'Guest', color: '#64748b', system: true, permissions: [] },
  ],
  members: { [uid]: { userId: uid, roleId: 'role-owner', capacityHours: 40, status: 'active' } },
  tags: [{ id: 'tag-bug', label: 'bug', hue: 0 }],
  audit: [],
  // NOTE: no `teams` — this is the whole point.
});

(async () => {
  const auth = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'migtest+1@kuberya.dev', password: 'Test12345!' }),
  }).then((r) => r.json());
  const { user, token } = auth.data;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.log('  [pageerror]', e.message.split('\n')[0]); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([payload, org]) => {
    localStorage.setItem('kuberya.auth', JSON.stringify(payload));
    localStorage.setItem('persist:kuberya-root', JSON.stringify({
      org: JSON.stringify(org), _persist: JSON.stringify({ version: 1, rehydrated: true }),
    }));
  }, [{ user, token }, legacyOrg(user.id)]);

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  console.log('Admin panel opened. Errors so far:', errors.length);

  console.log('--- clicking Teams ---');
  await page.getByRole('button', { name: 'Teams' }).first().click();
  await page.waitForTimeout(1500);

  const crashed = errors.some((e) => /undefined|null/i.test(e));
  console.log('\nTeams tab crashed?', crashed ? 'YES' : 'no');
  console.log('Teams UI rendered?', (await page.getByPlaceholder('New team name…').count()) > 0 ? 'yes' : 'NO');
  if (errors.length) console.log('\nFirst error:\n', errors[0].split('\n').slice(0, 3).join('\n'));

  await page.screenshot({ path: '.teams-crash.png' });
  await browser.close();
})();
