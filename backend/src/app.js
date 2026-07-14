const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const projectsRoutes = require('./modules/projects/projects.routes');
const { nestedRouter: taskNestedRoutes, flatRouter: taskFlatRoutes } = require('./modules/tasks/tasks.routes');
const voiceRoutes = require('./modules/voice/voice.routes');
const { errorMiddleware } = require('./middleware/error.middleware');
const { ApiError } = require('./utils/ApiError');

const app = express();

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Simplest possible smoke test — confirms the server is up before anything else is wired in.
app.get('/api/health', (req, res) => res.send('server working'));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/projects/:projectId/tasks/voice', voiceRoutes);
app.use('/api/projects/:projectId/tasks', taskNestedRoutes);
app.use('/api/tasks', taskFlatRoutes);

app.use((req, res, next) => next(new ApiError(404, 'Route not found')));
app.use(errorMiddleware);

module.exports = app;
