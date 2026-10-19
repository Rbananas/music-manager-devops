const express = require('express');
const mongoose = require('mongoose');
const Playlist = require('../models/Playlist');
const Track = require('../models/Track');
const authenticate = require('../middleware/authenticate');
const requireDatabase = require('../middleware/requireDatabase');

function createPlaylistRouter(config) {
  const router = express.Router();
  router.use(authenticate(config), requireDatabase);

  router.get('/', async (req, res, next) => {
    try {
      const playlists = await Playlist.find({ owner: req.userId }).populate('tracks', 'title artist album duration').sort({ updatedAt: -1 });
      res.json({ playlists });
    } catch (error) { next(error); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { name, description = '' } = req.body || {};
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || typeof description !== 'string' || description.length > 280) {
        return res.status(400).json({ error: { message: 'Name is required (max 80 characters); description must be 280 characters or fewer' } });
      }
      const playlist = await Playlist.create({ owner: req.userId, name: name.trim(), description: description.trim() });
      res.status(201).json({ playlist });
    } catch (error) { next(error); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const body = req.body || {};
      const updates = {};
      if ('name' in body) {
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) {
          return res.status(400).json({ error: { message: 'Name is required and must be 80 characters or fewer' } });
        }
        updates.name = body.name.trim();
      }
      if ('description' in body) {
        if (typeof body.description !== 'string' || body.description.length > 280) {
          return res.status(400).json({ error: { message: 'Description must be 280 characters or fewer' } });
        }
        updates.description = body.description.trim();
      }
      if ('tracks' in body) {
        if (!Array.isArray(body.tracks) || body.tracks.some((id) => !mongoose.isValidObjectId(id))) {
          return res.status(400).json({ error: { message: 'Tracks must be an array of valid track IDs' } });
        }
        const ids = [...new Set(body.tracks.map(String))];
        const ownedCount = await Track.countDocuments({ _id: { $in: ids }, owner: req.userId });
        if (ownedCount !== ids.length) return res.status(400).json({ error: { message: 'Playlists can only contain your own tracks' } });
        updates.tracks = ids;
      }
      const playlist = await Playlist.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, updates, { new: true, runValidators: true }).populate('tracks', 'title artist album duration');
      if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });
      res.json({ playlist });
    } catch (error) { next(error); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const playlist = await Playlist.findOneAndDelete({ _id: req.params.id, owner: req.userId });
      if (!playlist) return res.status(404).json({ error: { message: 'Playlist not found' } });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = createPlaylistRouter;
