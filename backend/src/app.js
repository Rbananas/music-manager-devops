const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRoutes = require('./routes/health');
const { router: authRoutes } = require('./routes/auth');
const createTrackRouter = require('./routes/tracks');
const createPlaylistRouter = require('./routes/playlists');
const { register: metricsRegistry, instrumentRequests } = require('./config/metrics');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

function createApp(config) {
  const app = express();
  app.locals.config = config;

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(instrumentRequests);

  app.get('/', (req, res) => {
    res.json({ name: 'Music Manager API', version: '1.0.0' });
  });
  app.get('/metrics', async (req, res, next) => {
    try {
      res.set('Content-Type', metricsRegistry.contentType);
      res.end(await metricsRegistry.metrics());
    } catch (error) { next(error); }
  });
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/tracks', createTrackRouter(config));
  app.use('/api/playlists', createPlaylistRouter(config));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
