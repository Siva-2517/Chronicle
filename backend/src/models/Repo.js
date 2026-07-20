const mongoose = require('mongoose');

const RepoSchema = new mongoose.Schema({
  owner: {
    type: String,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  lastIngestedCommitSha: {
    type: String,
    default: '',
  },
  ingestionStatus: {
    type: String,
    enum: ['pending', 'ingesting', 'completed', 'failed'],
    default: 'pending',
  },
  errorMessage: {
    type: String,
    default: '',
  },
  githubToken: {
    type: String,
    default: '',
  },
  githubUsername: {
    type: String,
    default: '',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Composite unique index to avoid duplicate repos per user
RepoSchema.index({ owner: 1, name: 1, githubUsername: 1 }, { unique: true });

RepoSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Repo', RepoSchema);
