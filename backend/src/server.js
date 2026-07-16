const http = require('http');
const cron = require('node-cron');
const app = require('./app');
const env = require('./config/env');
const { attachRealtime } = require('./realtime');
const { sendOverdueReminders } = require('./jobs/overdueReminders');

// Wrap the Express app in an HTTP server so Socket.IO can share the same port.
const server = http.createServer(app);
attachRealtime(server);

// Daily digest of overdue tasks, one email per assignee. Runs at 09:00 server time.
cron.schedule('0 9 * * *', () => {
  sendOverdueReminders().catch((err) => console.error('[overdueReminders] job failed:', err));
});

server.listen(env.port, () => {
  console.log(`Task Board API + realtime listening on port ${env.port} (${env.nodeEnv})`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
