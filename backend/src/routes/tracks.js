const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const Track = require('../models/Track');
const authenticate = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');

function createTrackRouter(config) {
  const router = express.Router();
  const storage = multer.diskStorage({
    destination: async (req, file, callback) => {
      try {
        await fs.promises.mkdir(config.uploadDir, { recursive: true });
        callback(null, config.uploadDir);
      } catch (error) {
        callback(error);
      }
    },
    filename: (req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  });
  const audioTypes = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/aac', 'audio/webm']);
  const upload = multer({
    storage,
    limits: { fileSize: config.maxUploadSizeMb * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => callback(null, audioTypes.has(file.mimetype))
  });
  const protectedRoute = [authenticate(config), requireDatabase];

  router.get('/', ...protectedRoute, async (req, res, next) => {
    try {
      const filter = { owner: req.userId };
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (query) {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [{ title: new RegExp(escaped, 'i') }, { artist: new RegExp(escaped, 'i') }, { album: new RegExp(escaped, 'i') }];
      }
      const allowedSorts = new Set(['title', 'artist', 'createdAt', 'album']);
      const sortBy = allowedSorts.has(req.query.sort) ? req.query.sort : 'createdAt';
      const direction = req.query.order === 'asc' ? 1 : -1;
      const tracks = await Track.find(filter).sort({ [sortBy]: direction }).lean();
      res.json({ tracks });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', ...protectedRoute, (req, res, next) => {
    upload.single('audio')(req, res, async (uploadError) => {
      if (uploadError) {
        const message = uploadError.code === 'LIMIT_FILE_SIZE'
          ? `Audio must be smaller than ${config.maxUploadSizeMb} MB`
          : uploadError.message;
        return res.status(400).json({ error: { message } });
      }
      if (!req.file) return res.status(400).json({ error: { message: 'An audio file is required (field: audio)' } });
      const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
      const artist = typeof req.body.artist === 'string' ? req.body.artist.trim() : '';
      const album = typeof req.body.album === 'string' ? req.body.album.trim() : '';
      if (!title || !artist || title.length > 120 || artist.length > 120 || album.length > 120) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: { message: 'Title and artist are required (max 120 characters); album must be 120 characters or fewer' } });
      }
      try {
        const track = await Track.create({
          owner: req.userId, title, artist, album,
          originalName: path.basename(req.file.originalname), fileName: req.file.filename,
          mimeType: req.file.mimetype, size: req.file.size
        });
        res.status(201).json({ track });
      } catch (error) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        next(error);
      }
    });
  });

  router.get('/:id/stream', ...protectedRoute, async (req, res, next) => {
    try {
      const track = await Track.findOne({ _id: req.params.id, owner: req.userId });
      if (!track) return res.status(404).json({ error: { message: 'Track not found' } });
      const filePath = path.resolve(config.uploadDir, track.fileName);
      if (!filePath.startsWith(`${path.resolve(config.uploadDir)}${path.sep}`)) {
        return res.status(400).json({ error: { message: 'Invalid media path' } });
      }
      res.type(track.mimeType);
      res.set('Accept-Ranges', 'bytes');
      res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', ...protectedRoute, async (req, res, next) => {
    try {
      const track = await Track.findOneAndDelete({ _id: req.params.id, owner: req.userId });
      if (!track) return res.status(404).json({ error: { message: 'Track not found' } });
      await fs.promises.unlink(path.join(config.uploadDir, track.fileName)).catch((error) => {
        if (error.code !== 'ENOENT') console.error(`Unable to remove audio file ${track.fileName}:`, error.message);
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createTrackRouter;
