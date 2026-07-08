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

// 1. REPO ROUTES

// List all repositories
app.get('/api/repos', async (req, res) => {
  try {
    const repos = await Repo.find().sort({ createdAt: -1 });
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect and trigger Ingestion of a repo
app.post('/api/repos/connect', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) {
      return res.status(400).json({ error: 'repoUrl is required' });
    }

    const { owner, name } = parseRepoUrl(repoUrl);
    
    // Check if repo already exists
    let repo = await Repo.findOne({ owner, name });
    
    if (repo) {
      // If ingestion failed or was completed, we can trigger it again
      if (repo.ingestionStatus === 'completed' || repo.ingestionStatus === 'failed') {
        repo.ingestionStatus = 'pending';
        repo.errorMessage = '';
        await repo.save();
        
        // Trigger background ingestion asynchronously
        startIngestion(repo._id, io);
      }
      return res.json(repo);
    }

    // Create new repo
    repo = new Repo({ owner, name, ingestionStatus: 'pending' });
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
    const agentServiceUrl = process.env.AGENT_SERVICE_URL;
    let responseText = '';
    let citations = [];

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
    }

    // 3. Add assistant response with citations
    session.messages.push({
      role: 'assistant',
      content: responseText,
      citations: citations,
    });
    await session.save();

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger decision extraction for a file or function manually
app.post('/api/repos/:id/extract-decision', async (req, res) => {
  try {
    const repoId = req.params.id;
    const { filePath, functionName } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const agentServiceUrl = process.env.AGENT_SERVICE_URL;
    
    // Call agent service
    const agentRes = await axios.post(`${agentServiceUrl}/api/agent/extract`, {
      repo_id: repoId,
      file_path: filePath,
      function_name: functionName || null,
    });

    const result = agentRes.data;
    const decisionsData = result.decisions || [result];
    
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
    
    res.json(savedDecisions[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Chronicle backend running on port ${PORT}`);
});
