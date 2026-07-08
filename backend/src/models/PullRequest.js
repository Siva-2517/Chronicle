const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  author: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  path: {
    type: String, // File path if it's a review comment on code
  },
  diffHunk: {
    type: String, // Context around the code comment
  },
});

const ReviewSchema = new mongoose.Schema({
  author: {
    type: String,
    required: true,
  },
  state: {
    type: String, // APPROVED, CHANGES_REQUESTED, COMMENTED, etc.
    required: true,
  },
  body: {
    type: String,
  },
  submittedAt: {
    type: Date,
  },
});

const PullRequestSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repo',
    required: true,
  },
  number: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
  },
  state: {
    type: String, // open, closed
    required: true,
  },
  htmlUrl: {
    type: String,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  closedAt: {
    type: Date,
  },
  mergedAt: {
    type: Date,
  },
  comments: [CommentSchema],
  reviews: [ReviewSchema],
  associatedCommits: [{
    type: String, // list of commit SHAs
  }],
});

PullRequestSchema.index({ repoId: 1, number: 1 }, { unique: true });
PullRequestSchema.index({ title: 'text', body: 'text', 'comments.body': 'text' });

module.exports = mongoose.model('PullRequest', PullRequestSchema);
