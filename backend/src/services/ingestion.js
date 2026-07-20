const Repo = require('../models/Repo');
const Commit = require('../models/Commit');
const PullRequest = require('../models/PullRequest');
const github = require('./github');

// Simple helper to sleep/delay (used to respect GitHub rate limits if needed)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the ingestion pipeline for a given repository.
 * Emits progress messages via Socket.io using the repo's ID as room.
 */
async function startIngestion(repoId, io) {
  const emitProgress = (step, progress = {}) => {
    if (io) {
      io.to(repoId.toString()).emit('ingestion_progress', {
        repoId: repoId.toString(),
        step,
        timestamp: new Date(),
        ...progress,
      });
    }
  };

  let repo;
  try {
    repo = await Repo.findById(repoId);
    if (!repo) {
      console.error(`Repo not found: ${repoId}`);
      return;
    }

    console.log(`Starting ingestion for ${repo.owner}/${repo.name}`);
    repo.ingestionStatus = 'ingesting';
    repo.errorMessage = '';
    await repo.save();

    emitProgress('started', { message: 'Initializing connection to GitHub...' });

    // 1. Fetch Repository Details to verify access
    const details = await github.getRepoDetails(repo.owner, repo.name, repo.githubToken);
    console.log(`Found repo: ${details.owner}/${details.name}`);

    // 2. Fetch Commits
    emitProgress('fetching_commits', { message: 'Fetching commit history from GitHub...' });
    const commitsList = await github.fetchCommits(repo.owner, repo.name, 50, repo.githubToken);
    console.log(`Fetched ${commitsList.length} commits for ${repo.owner}/${repo.name}`);

    emitProgress('ingesting_commits', {
      message: 'Analyzing commits and downloading code patches...',
      current: 0,
      total: commitsList.length
    });

    const detailedCommits = [];
    // Fetch details for each commit. We fetch in series/small batches to prevent hitting secondary rate limits.
    for (let i = 0; i < commitsList.length; i++) {
      const commitMeta = commitsList[i];

      // Update progress every few commits
      emitProgress('ingesting_commits', {
        message: `Downloading patch for commit ${commitMeta.sha.substring(0, 7)}...`,
        current: i + 1,
        total: commitsList.length
      });

      const details = await github.fetchCommitDetails(repo.owner, repo.name, commitMeta.sha, repo.githubToken);

      // Save or update in MongoDB
      await Commit.findOneAndUpdate(
        { repoId, sha: details.sha },
        { ...details, repoId },
        { upsert: true, new: true }
      );

      detailedCommits.push(details);
      // Tiny delay to respect Github API rate limits
      await delay(100);
    }

    // 3. Fetch PRs
    emitProgress('fetching_prs', { message: 'Fetching pull requests and developer discussions...' });
    const prsList = await github.fetchPullRequests(repo.owner, repo.name, 30, repo.githubToken);
    console.log(`Fetched ${prsList.length} pull requests`);

    emitProgress('ingesting_prs', {
      message: 'Extracting reviews, inline comments, and issue links...',
      current: 0,
      total: prsList.length
    });

    for (let i = 0; i < prsList.length; i++) {
      const prMeta = prsList[i];

      emitProgress('ingesting_prs', {
        message: `Extracting comments for PR #${prMeta.number}...`,
        current: i + 1,
        total: prsList.length
      });

      const details = await github.fetchPRCommentsAndReviews(repo.owner, repo.name, prMeta.number, repo.githubToken);

      const prData = {
        repoId,
        number: prMeta.number,
        title: prMeta.title,
        body: prMeta.body,
        state: prMeta.state,
        htmlUrl: prMeta.html_url,
        createdAt: new Date(prMeta.created_at),
        closedAt: prMeta.closed_at ? new Date(prMeta.closed_at) : null,
        mergedAt: prMeta.merged_at ? new Date(prMeta.merged_at) : null,
        comments: details.comments,
        reviews: details.reviews,
        associatedCommits: details.associatedCommits,
      };

      // Save or update in MongoDB
      await PullRequest.findOneAndUpdate(
        { repoId, number: prData.number },
        prData,
        { upsert: true, new: true }
      );

      await delay(100);
    }

    // 4. Wrap up Ingestion
    const latestCommitSha = commitsList.length > 0 ? commitsList[0].sha : '';
    repo.ingestionStatus = 'completed';
    repo.lastIngestedCommitSha = latestCommitSha;
    repo.errorMessage = '';
    await repo.save();

    console.log(`Successfully completed ingestion for ${repo.owner}/${repo.name}`);
    emitProgress('completed', {
      message: `Ingestion completed! Loaded ${commitsList.length} commits and ${prsList.length} PRs.`
    });

  } catch (error) {
    console.error(`Ingestion failed for repo ${repoId}:`, error);

    if (repo) {
      repo.ingestionStatus = 'failed';
      repo.errorMessage = error.message;
      await repo.save();
    }

    emitProgress('failed', { message: `Ingestion failed: ${error.message}` });
  }
}

module.exports = {
  startIngestion,
};
