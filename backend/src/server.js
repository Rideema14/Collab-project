const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`Task Board API listening on port ${env.port} (${env.nodeEnv})`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
