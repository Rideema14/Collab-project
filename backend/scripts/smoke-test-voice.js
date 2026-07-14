const path = require('path');
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

async function main() {
  const {
    resolveAssignee,
    isValidIsoDate,
    parseExtractionResponse,
    buildExtractionPrompt,
  } = require(path.join(__dirname, '..', 'src/modules/voice/voice.parser'));

  const team = [
    { id: 1, name: 'Asha Rao', email: 'asha@example.com' },
    { id: 2, name: 'Ben Fischer', email: 'ben@example.com' },
  ];

  console.log('== voice.parser unit tests (no network) ==');
  check('resolveAssignee: exact full name', resolveAssignee('Asha Rao', team)?.id === 1);
  check('resolveAssignee: first name only', resolveAssignee('Ben', team)?.id === 2);
  check('resolveAssignee: case-insensitive', resolveAssignee('asha rao', team)?.id === 1);
  check('resolveAssignee: email local-part', resolveAssignee('ben', team)?.id === 2);
  check('resolveAssignee: no match -> null', resolveAssignee('Priya', team) === null);
  check('resolveAssignee: null input -> null', resolveAssignee(null, team) === null);

  check('isValidIsoDate: valid date', isValidIsoDate('2026-07-20') === true);
  check('isValidIsoDate: garbage string', isValidIsoDate('next friday') === false);
  check('isValidIsoDate: wrong format', isValidIsoDate('20-07-2026') === false);
  check('isValidIsoDate: null', isValidIsoDate(null) === false);

  check(
    'parseExtractionResponse: clean JSON',
    (() => {
      const r = parseExtractionResponse('{"title":"Fix bug","assigneeNameHeard":"Ben","assigneeName":"Ben Fischer","dueDate":"2026-07-20"}');
      return r.title === 'Fix bug' && r.assigneeName === 'Ben Fischer' && r.dueDate === '2026-07-20';
    })()
  );
  check(
    'parseExtractionResponse: strips markdown fences the model added despite instructions',
    (() => {
      const r = parseExtractionResponse('```json\n{"title":"Fix bug","assigneeNameHeard":null,"assigneeName":null,"dueDate":null}\n```');
      return r.title === 'Fix bug' && r.assigneeName === null;
    })()
  );
  {
    let threw = false;
    try {
      parseExtractionResponse('not json at all');
    } catch (err) {
      threw = err.statusCode === 502;
    }
    check('parseExtractionResponse: malformed JSON throws ApiError(502)', threw);
  }

  {
    const prompt = buildExtractionPrompt('assign the homepage redesign to asha for next friday', team, '2026-07-14');
    check('buildExtractionPrompt: includes team roster', prompt.system.includes('Asha Rao (asha@example.com)'));
    check('buildExtractionPrompt: includes today date', prompt.system.includes('2026-07-14'));
    check('buildExtractionPrompt: user is the raw transcript', prompt.user === 'assign the homepage redesign to asha for next friday');
  }

  // --- Service-level integration test with a FAKE Groq client (no network) ---
  console.log('== voice.service integration test (fake Groq client, real DB) ==');
  const { pool } = require(path.join(__dirname, '..', 'src/config/db'));

  // Need a real user + project to attach a task to.
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash('testpass123', 10);
  const userRes = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    ['Voice Test User', `voice.test.${Date.now()}@example.com`, passwordHash]
  );
  const creatorId = userRes.rows[0].id;
  const projRes = await pool.query(
    `INSERT INTO projects (name, created_by) VALUES ($1,$2) RETURNING id`,
    ['Voice Test Project', creatorId]
  );
  const projectId = projRes.rows[0].id;

  const voiceService = require(path.join(__dirname, '..', 'src/modules/voice/voice.service'));

  const fakeClient = {
    async transcribeAudio(buffer) {
      check('fake transcribeAudio received a Buffer', Buffer.isBuffer(buffer));
      return 'assign fix the login bug to asha rao due tomorrow';
    },
    async extractTaskFields(prompt) {
      check('fake extractTaskFields received system+user prompt', typeof prompt.system === 'string' && typeof prompt.user === 'string');
      return JSON.stringify({
        title: 'Fix the login bug',
        assigneeNameHeard: 'asha rao',
        assigneeName: 'Asha Rao',
        dueDate: '2026-07-15',
      });
    },
  };

  // Seed a real "Asha Rao" for this test's team roster lookup
  await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`,
    ['Asha Rao', 'asha@example.com', passwordHash]
  );

  {
    const result = await voiceService.createTaskFromVoice(
      { projectId, audioBuffer: Buffer.from('fake-audio-bytes') },
      fakeClient
    );
    check('createTaskFromVoice: task created with parsed title', result.task.title === 'Fix the login bug', result);
    check('createTaskFromVoice: task defaults to To Do status', result.task.status === 'To Do', result);
    check('createTaskFromVoice: assignee resolved to Asha Rao', result.task.assignee?.name === 'Asha Rao', result);
    check('createTaskFromVoice: due date carried through as plain YYYY-MM-DD string', result.task.dueDate === '2026-07-15', result);
    check('createTaskFromVoice: voice metadata includes transcript', result.voice.transcript.includes('login bug'), result);
    check('createTaskFromVoice: no warnings when everything resolves', result.voice.warnings.length === 0, result);
  }

  // Unmatched assignee name -> task still created, but unassigned + warning
  {
    const fuzzyClient = {
      async extractTaskFields() {
        return JSON.stringify({
          title: 'Prepare investor deck',
          assigneeNameHeard: 'that new guy nobody has met',
          assigneeName: null,
          dueDate: 'sometime soon-ish',
        });
      },
    };
    const result = await voiceService.createTaskFromVoice(
      { projectId, transcript: 'assign prepare investor deck to that new guy nobody has met' },
      fuzzyClient
    );
    check('unmatched assignee: task still created', result.task.title === 'Prepare investor deck', result);
    check('unmatched assignee: left unassigned rather than guessing', result.task.assignee === null, result);
    check('unmatched assignee: invalid due date dropped, not sent to DB', result.task.dueDate === null, result);
    check('unmatched assignee: warning explains why', result.voice.warnings.some((w) => w.includes('team member')), result);
  }

  // Empty/garbage title from the model -> caught before creating anything
  {
    const emptyClient = {
      async extractTaskFields() {
        return JSON.stringify({ title: '', assigneeNameHeard: null, assigneeName: null, dueDate: null });
      },
    };
    let threw = false;
    try {
      await voiceService.createTaskFromVoice({ projectId, transcript: 'uh, hmm' }, emptyClient);
    } catch (err) {
      threw = err.statusCode === 422;
    }
    check('empty title from model -> 422, nothing created', threw);
  }

  await pool.end();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Voice test script crashed:', err);
  process.exitCode = 1;
});
