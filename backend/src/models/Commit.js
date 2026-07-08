const mongoose = require('mongoose');

const CommitFileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  status: {
    type: String, // modified, added, removed, renamed
  },
  additions: {
    type: Number,
    default: 0,
  },
  deletions: {
    type: Number,
    default: 0,
  },
  changes: {
    type: Number,
    default: 0,
  },
  patch: {
    type: String, // The actual git diff patch for this file
  },
});

const CommitSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repo',
    required: true,
  },
  sha: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  author: {
    name: { type: String },
    email: { type: String },
    date: { type: Date },
  },
  htmlUrl: {
    type: String,
  },
  files: [CommitFileSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

CommitSchema.index({ repoId: 1, sha: 1 }, { unique: true });
// Add text index on message and filenames for searching/retrieval
CommitSchema.index({ message: 'text', 'files.filename': 'text' });

module.exports = mongoose.model('Commit', CommitSchema);
