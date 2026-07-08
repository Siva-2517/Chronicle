const mongoose = require('mongoose');

const DecisionRecordSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repo',
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  functionName: {
    type: String, // Optional, can be null if it's file-level
  },
  commitSha: {
    type: String,
  },
  prNumber: {
    type: Number,
  },
  summary: {
    type: String,
    required: true,
  },
  embeddingId: {
    type: String, // ID referencing a record in a vector DB
  },
  staleness: {
    checked: { type: Boolean, default: false },
    isStale: { type: Boolean, default: false },
    reason: { type: String, default: '' },
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

DecisionRecordSchema.index({ repoId: 1, filePath: 1 });
DecisionRecordSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DecisionRecord', DecisionRecordSchema);
