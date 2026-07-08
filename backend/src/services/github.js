const { Octokit } = require('@octokit/rest');

// Initialize Octokit. If GITHUB_TOKEN is available in env, use it for higher rate limits.
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined,
});

/**
 * Validates and gets details of a GitHub repository
 */
async function getRepoDetails(owner, repo) {
  try {
    const { data } = await octokit.repos.get({ owner, repo });
    return {
      owner: data.owner.login,
      name: data.name,
      description: data.description,
      defaultBranch: data.default_branch,
    };
  } catch (error) {
    throw new Error(`Failed to fetch repo ${owner}/${repo}: ${error.message}`);
  }
}

/**
 * Fetches commits from a GitHub repository
 */
async function fetchCommits(owner, repo, limit = 50) {
  try {
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: Math.min(limit, 100),
    });
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch commits for ${owner}/${repo}: ${error.message}`);
  }
}

/**
 * Fetches detailed files and patches for a specific commit
 */
async function fetchCommitDetails(owner, repo, sha) {
  try {
    const { data } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });
    return {
      sha: data.sha,
      message: data.commit.message,
      author: {
        name: data.commit.author.name,
        email: data.commit.author.email,
        date: data.commit.author.date,
      },
      htmlUrl: data.html_url,
      files: data.files.map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch || '',
      })),
    };
  } catch (error) {
    console.error(`Error fetching commit details for ${sha}:`, error.message);
    // Return minimal info on error to not crash the ingestion
    return {
      sha,
      message: 'Failed to fetch details',
      files: [],
    };
  }
}

/**
 * Fetches pull requests (including merged/closed ones)
 */
async function fetchPullRequests(owner, repo, limit = 50) {
  try {
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: Math.min(limit, 100),
      sort: 'updated',
      direction: 'desc',
    });
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch PRs for ${owner}/${repo}: ${error.message}`);
  }
}

/**
 * Fetches comments (issue and review comments) and reviews for a Pull Request
 */
async function fetchPRCommentsAndReviews(owner, repo, number) {
  try {
    // 1. Fetch issue comments (conversations)
    const issueCommentsPromise = octokit.issues.listComments({
      owner,
      repo,
      issue_number: number,
    }).then(res => res.data).catch(() => []);

    // 2. Fetch review comments (inline on code diffs)
    const reviewCommentsPromise = octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: number,
    }).then(res => res.data).catch(() => []);

    // 3. Fetch reviews status
    const reviewsPromise = octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: number,
    }).then(res => res.data).catch(() => []);

    // 4. Fetch PR commits to map association
    const prCommitsPromise = octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: number,
    }).then(res => res.data.map(c => c.sha)).catch(() => []);

    const [issueComments, reviewComments, reviews, prCommits] = await Promise.all([
      issueCommentsPromise,
      reviewCommentsPromise,
      reviewsPromise,
      prCommitsPromise,
    ]);

    // Map comments together
    const comments = [];
    
    // Add general PR discussion comments
    for (const c of issueComments) {
      comments.push({
        author: c.user ? c.user.login : 'unknown',
        body: c.body,
        createdAt: new Date(c.created_at),
      });
    }

    // Add inline review comments
    for (const c of reviewComments) {
      comments.push({
        author: c.user ? c.user.login : 'unknown',
        body: c.body,
        createdAt: new Date(c.created_at),
        path: c.path,
        diffHunk: c.diff_hunk,
      });
    }

    // Map reviews
    const mappedReviews = reviews.map(r => ({
      author: r.user ? r.user.login : 'unknown',
      state: r.state,
      body: r.body || '',
      submittedAt: r.submitted_at ? new Date(r.submitted_at) : null,
    }));

    return {
      comments,
      reviews: mappedReviews,
      associatedCommits: prCommits,
    };
  } catch (error) {
    console.error(`Error fetching PR details for #${number}:`, error.message);
    return {
      comments: [],
      reviews: [],
      associatedCommits: [],
    };
  }
}

module.exports = {
  getRepoDetails,
  fetchCommits,
  fetchCommitDetails,
  fetchPullRequests,
  fetchPRCommentsAndReviews,
};
