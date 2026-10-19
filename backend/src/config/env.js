const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getConfig() {
  const port = Number.parseInt(process.env.PORT || '4000', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const maxUploadSizeMb = Number.parseInt(process.env.MAX_UPLOAD_SIZE_MB || '25', 10);
  if (!Number.isInteger(maxUploadSizeMb) || maxUploadSizeMb < 1 || maxUploadSizeMb > 250) {
    throw new Error('MAX_UPLOAD_SIZE_MB must be an integer between 1 and 250');
  }
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret && (jwtSecret.startsWith('replace-') || Buffer.byteLength(jwtSecret) < 32)) {
    throw new Error('JWT_SECRET must be a unique value of at least 32 bytes');
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port,
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    mongoUri: process.env.MONGODB_URI || '',
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
    maxUploadSizeMb
  };
}

module.exports = { getConfig };
