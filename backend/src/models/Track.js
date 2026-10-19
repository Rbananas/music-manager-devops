const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  artist: { type: String, required: true, trim: true, maxlength: 120 },
  album: { type: String, trim: true, maxlength: 120, default: '' },
  originalName: { type: String, required: true },
  fileName: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  duration: { type: Number, min: 0, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Track', trackSchema);
