const mongoose = require('mongoose');

const CitationSchema = new mongoose.Schema({
  type: {
    type: String, // 'commit' or 'pr'
    enum: ['commit', 'pr'],
    required: true,
  },
  sha: {
    type: String,
  },
  number: {
    type: Number,
  },
  title: {
    type: String,
  },
  url: {
    type: String,
  },
});

const MessageSchema = new mongoose.Schema({
  role: {
    type: String, // 'user', 'assistant', 'system'
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  citations: [CitationSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ChatSessionSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repo',
    required: true,
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

ChatSessionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
