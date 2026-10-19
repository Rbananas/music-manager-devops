const { createApp } = require('./app');
const { getConfig } = require('./config/env');
const { connectDatabase } = require('./config/database');
const mongoose = require('mongoose');

let server;

async function start() {
  const config = getConfig();
  if (config.mongoUri) {
    await connectDatabase(config.mongoUri);
    console.log('MongoDB connection established');
  } else {
    console.warn('MONGODB_URI is not set; database-backed API routes will return 503');
  }
  const app = createApp(config);
  server = app.listen(config.port, () => {
    console.log(`Music Manager API listening on port ${config.port} (${config.nodeEnv})`);
  });
}

start().catch((error) => {
  console.error(`Failed to start Music Manager API: ${error.message}`);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down Music Manager API`);
  if (!server) return;
  server.close(async (error) => {
    if (error) {
      console.error('Error while closing the HTTP server', error);
      process.exitCode = 1;
    }
    await mongoose.disconnect();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
