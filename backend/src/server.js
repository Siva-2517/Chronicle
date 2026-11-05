require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

const Repo = require('./models/Repo');
const Commit = require('./models/Commit');
const PullRequest = require('./models/PullRequest');
const ChatSession = require('./models/ChatSession');
const DecisionRecord = require('./models/DecisionRecord');
const { startIngestion } = require('./services/ingestion');
const github = require('./services/github');

const app = express();
const server = http.createServer(app);

// Configure CORS to allow access from local React and Vue dev servers
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI environment variable is required.');
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB successfully.'))
  .catch((err) => console.error('MongoDB connection error:', err));

// WebSocket logic
io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);

  // Join a room for a specific repository ingestion
  socket.on('join_repo', (repoId) => {
    socket.join(repoId);
    console.log(`Socket ${socket.id} joined room ${repoId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

// Helper to parse repoUrl into owner and name
function parseRepoUrl(url) {
  // Matches "https://github.com/owner/repo" or "owner/repo"
  const cleanUrl = url.replace(/https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  const parts = cleanUrl.split('/');
  if (parts.length < 2) {
    throw new Error('Invalid repository format. Use owner/repo or github url');
  }
  return { owner: parts[0].trim(), name: parts[1].trim() };
}

// --- API ROUTES ---

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Chronicle Backend API is running' });
});

// GitHub PAT token validation and user repository loading
app.post('/api/github/validate-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });
    const user = await github.validateToken(token);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/github/repos', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });
    const userRepos = await github.fetchUserRepos(token);
    res.json(userRepos);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Real GitHub OAuth connected app redirection endpoints
app.get('/api/github/oauth/login', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const defaultCallback = `${req.protocol}://${req.get('host')}/auth/github/callback`;
  const redirectUri = process.env.REDIRECT_URI || defaultCallback;
  const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(authorizeUrl);
});

app.get('/auth/github/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { code, error, error_description } = req.query;

    // Handle user cancellation or missing authorization code
    if (error || !code) {
      const errorMsg = error_description || 'GitHub authorization was cancelled.';
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent(errorMsg)}`);
    }

    // Exchange the authorization code for access token
    const tokenExchangeResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const token = tokenExchangeResponse.data.access_token;
    if (!token) {
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent('Failed to exchange code for access token.')}`);
    }

    // Redirect user back to the React client with token in search parameters
    res.redirect(`${frontendUrl}?token=${token}`);
  } catch (error) {
    console.error('Error exchanging GitHub OAuth code:', error.message);
    res.redirect(`${frontendUrl}?error=${encodeURIComponent(error.message)}`);
  }
});

// 1. REPO ROUTES

// List all repositories for a user (or all if username not provided)
app.get('/api/repos', async (req, res) => {
  try {
    const { username } = req.query;
    const query = username ? { githubUsername: username } : {};
    const repos = await Repo.find(query).sort({ createdAt: -1 });
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect and trigger Ingestion of a repo scoped to a user
app.post('/api/repos/connect', async (req, res) => {
  try {
    const { repoUrl, githubToken, githubUsername } = req.body;
    if (!repoUrl) {
      return res.status(400).json({ error: 'repoUrl is required' });
    }

    const { owner, name } = parseRepoUrl(repoUrl);
    const userScope = githubUsername || '';
    
    // Check if repo already exists for this user scope
    let repo = await Repo.findOne({ owner, name, githubUsername: userScope });
    
    if (repo) {
      // Update token if new one is supplied
      if (githubToken) {
        repo.githubToken = githubToken;
      }
      // If ingestion failed or was completed, we can trigger it again
      if (repo.ingestionStatus === 'completed' || repo.ingestionStatus === 'failed') {
        repo.ingestionStatus = 'pending';
        repo.errorMessage = '';
        await repo.save();
        
        // Trigger background ingestion asynchronously
        startIngestion(repo._id, io);
      } else {
        await repo.save();
      }
      return res.json(repo);
    }

    // Create new repo
    repo = new Repo({ 
      owner, 
      name, 
      ingestionStatus: 'pending',
      githubToken: githubToken || '',
      githubUsername: userScope
    });
    await repo.save();

    // Trigger background ingestion asynchronously
    startIngestion(repo._id, io);

    res.status(201).json(repo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get detailed repo status/metadata
app.get('/api/repos/:id', async (req, res) => {
  try {
    const repo = await Repo.findById(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    res.json(repo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a repository and all related records
app.delete('/api/repos/:id', async (req, res) => {
  try {
    const repoId = req.params.id;
    const repo = await Repo.findById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    await Promise.all([
      Repo.findByIdAndDelete(repoId),
      Commit.deleteMany({ repoId }),
      PullRequest.deleteMany({ repoId }),
      ChatSession.deleteMany({ repoId }),
      DecisionRecord.deleteMany({ repoId }),
    ]);

    res.json({ message: 'Repository and all associated data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get commits for a repo
app.get('/api/repos/:id/commits', async (req, res) => {
  try {
    const commits = await Commit.find({ repoId: req.params.id })
      .select('sha message author htmlUrl createdAt')
      .sort({ 'author.date': -1 });
    res.json(commits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get details for a specific commit (including patches)
app.get('/api/repos/:id/commits/:sha', async (req, res) => {
  try {
    const commit = await Commit.findOne({ repoId: req.params.id, sha: req.params.sha });
    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }
    res.json(commit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get PRs for a repo
app.get('/api/repos/:id/prs', async (req, res) => {
  try {
    const prs = await PullRequest.find({ repoId: req.params.id })
      .select('number title state htmlUrl createdAt mergedAt')
      .sort({ createdAt: -1 });
    res.json(prs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get details for a specific PR
app.get('/api/repos/:id/prs/:number', async (req, res) => {
  try {
    const pr = await PullRequest.findOne({ repoId: req.params.id, number: req.params.number });
    if (!pr) {
      return res.status(404).json({ error: 'Pull Request not found' });
    }
    res.json(pr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get decisions (timeline data) for a repo
app.get('/api/repos/:id/decisions', async (req, res) => {
  try {
    const decisions = await DecisionRecord.find({ repoId: req.params.id })
      .sort({ createdAt: -1 });
    res.json(decisions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. CHAT ROUTES

// Create a new chat session for a repo
app.post('/api/chat/session', async (req, res) => {
  try {
    const { repoId } = req.body;
    if (!repoId) {
      return res.status(400).json({ error: 'repoId is required' });
    }

    const session = new ChatSession({ repoId, messages: [] });
    await session.save();
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chat session details (with message history)
app.get('/api/chat/session/:sessionId', async (req, res) => {
  try {
    const session = await ChatSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message to chat session and trigger FastAPI agent response
app.post('/api/chat/session/:sessionId/message', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'message content is required' });
    }

    const session = await ChatSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    // 1. Add user message to session
    session.messages.push({
      role: 'user',
      content,
      citations: [],
    });
    await session.save();

    // 2. Query Agent Python FastAPI Service
    const agentServiceUrl = process.env.AGENT_SERVICE_URL || 'http://localhost:8000';
    let responseText = '';
    let citations = [];

    // Emit synthesizing trace
    io.to(session.repoId.toString()).emit('agent_trace', {
      repoId: session.repoId.toString(),
      step: 'synthesizing',
      message: 'Synthesizing response from PR reviews and commit history...',
    });

    try {
      console.log(`Sending query to python agent at ${agentServiceUrl}/api/agent/chat...`);
      const agentRes = await axios.post(`${agentServiceUrl}/api/agent/chat`, {
        repo_id: session.repoId.toString(),
        session_id: session._id.toString(),
        message: content,
      });

      responseText = agentRes.data.response;
      citations = agentRes.data.citations || [];
    } catch (agentError) {
      console.error('Failed to communicate with python agent service:', agentError.message);
      responseText = "I'm sorry, I'm having trouble connecting to my decision analysis agent service right now. Please make sure the agent service is running.";
      citations = [];
      io.to(session.repoId.toString()).emit('agent_trace', {
        repoId: session.repoId.toString(),
        step: 'failed',
        message: 'Synthesis failed: ' + agentError.message,
      });
    }

    // 3. Add assistant response with citations
    session.messages.push({
      role: 'assistant',
      content: responseText,
      citations: citations,
    });
    await session.save();

    // Emit completed trace
    io.to(session.repoId.toString()).emit('agent_trace', {
      repoId: session.repoId.toString(),
      step: 'completed',
      message: 'Answer synthesized.',
    });

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger decision extraction for a file or function manually
app.post('/api/repos/:id/extract-decision', async (req, res) => {
  const repoId = req.params.id;
  try {
    const { filePath, functionName } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    // Emit extracting trace
    io.to(repoId).emit('agent_trace', {
      repoId,
      step: 'extracting',
      message: `Retrieving commit details and PR discussions for file: ${filePath}...`,
    });

    const agentServiceUrl = process.env.AGENT_SERVICE_URL || 'http://localhost:8000';

    // Call agent service
    const agentRes = await axios.post(`${agentServiceUrl}/api/agent/extract`, {
      repo_id: repoId,
      file_path: filePath,
      function_name: functionName || null,
    });

    const result = agentRes.data;
    const decisionsData = result.decisions || [result];

    // Emit verifying trace
    io.to(repoId).emit('agent_trace', {
      repoId,
      step: 'verifying',
      message: `Verifying extracted decisions against latest code state...`,
    });

    const savedDecisions = [];
    for (const item of decisionsData) {
      const decision = await DecisionRecord.findOneAndUpdate(
        {
          repoId,
          filePath,
          commitSha: item.commit_sha || '',
        },
        {
          repoId,
          filePath,
          functionName: functionName || null,
          commitSha: item.commit_sha || '',
          prNumber: item.pr_number || null,
          summary: item.summary,
          staleness: item.staleness || { checked: false, isStale: false, reason: '' },
        },
        { upsert: true, new: true }
      );
      savedDecisions.push(decision);
    }

    // Emit completed trace
    io.to(repoId).emit('agent_trace', {
      repoId,
      step: 'completed',
      message: `Extraction complete. Extracted ${savedDecisions.length} decisions.`,
    });

    res.json(savedDecisions[0] || {});
  } catch (error) {
    io.to(repoId).emit('agent_trace', {
      repoId,
      step: 'failed',
      message: `Extraction failed: ${error.message}`,
    });
    res.status(500).json({ error: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Chronicle backend running on port ${PORT}`);
});
