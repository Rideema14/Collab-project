const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { attachRealtime } = require('./realtime');

// Wrap the Express app in an HTTP server so Socket.IO can share the same port.
const server = http.createServer(app);
attachRealtime(server);

server.listen(env.port, () => {
  console.log(`Task Board API + realtime listening on port ${env.port} (${env.nodeEnv})`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
