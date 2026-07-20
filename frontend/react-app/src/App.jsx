import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import axios from 'axios';
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Github, 
  Activity,
  FolderGit2,
  FileSearch,
  Database,
  Lock,
  ChevronDown,
  KeyRound
} from 'lucide-react';

import { 
  setRepos, 
  addRepo, 
  setActiveRepoId, 
  updateIngestionProgress, 
  setLoading, 
  setError,
  deleteRepoInState
} from './store/repoSlice';

import { StrataPanel } from './components/StrataPanel';
import { ChatPanel } from './components/ChatPanel';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

function App() {
  const dispatch = useDispatch();
  const { repos, activeRepoId, ingestionProgress } = useSelector(state => state.repo);
  
  const [viewMode, setViewMode] = useState('connect');
  const [repoUrlInput, setRepoUrlInput] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  
  // GitHub Real Auth state (OAuth & PAT)
  const [githubToken, setGithubToken] = useState('');
  const [githubUser, setGithubUser] = useState(null);
  const [githubRepos, setGithubRepos] = useState([]);
  const [tokenInput, setTokenInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPatInput, setShowPatInput] = useState(false);
  
  // Chat state
  const [chatSession, setChatSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [agentTrace, setAgentTrace] = useState(null);
  
  // Repo details
  const [commits, setCommits] = useState([]);
  const [decisions, setDecisions] = useState([]);
  
  // Manual Decision extraction
  const [extractFilePath, setExtractFilePath] = useState('');
  const [extractionMsg, setExtractionMsg] = useState('');
  const [extractLoading, setExtractLoading] = useState(false);
  const [isExtractorOpen, setIsExtractorOpen] = useState(false);

  // Strata scroll-and-highlight highlight interaction
  const [highlightedEraId, setHighlightedEraId] = useState(null);

  const socketRef = useRef(null);
  const activeRepoIdRef = useRef(activeRepoId);
  useEffect(() => {
    activeRepoIdRef.current = activeRepoId;
  }, [activeRepoId]);

  const activeRepo = repos.find(r => r._id === activeRepoId);

  const fetchRepos = useCallback(async (username) => {
    dispatch(setLoading(true));
    try {
      const url = username 
        ? `${BACKEND_URL}/api/repos?username=${encodeURIComponent(username)}`
        : `${BACKEND_URL}/api/repos`;
      const res = await axios.get(url);
      dispatch(setRepos(res.data));
    } catch (err) {
      dispatch(setError(err.message));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const fetchRepoDetails = useCallback(async (repoId) => {
    try {
      const [commitsRes, decisionsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/repos/${repoId}/commits`),
        axios.get(`${BACKEND_URL}/api/repos/${repoId}/decisions`)
      ]);
      setCommits(commitsRes.data);
      setDecisions(decisionsRes.data);
    } catch (err) {
      console.error("Error fetching repository details", err);
    }
  }, []);

  const startChatSession = useCallback(async (repoId) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/chat/session`, { repoId });
      setChatSession(res.data);
      setMessages([]);
    } catch (err) {
      console.error("Error starting chat session", err);
    }
  }, []);

  // Authenticate using Personal Access Token or OAuth Access Token
  const handleAuthenticateToken = useCallback(async (tokenToAuth) => {
    if (!tokenToAuth || !tokenToAuth.trim()) return;
    setAuthLoading(true);
    try {
      const validateRes = await axios.post(`${BACKEND_URL}/api/github/validate-token`, { token: tokenToAuth.trim() });
      const userObj = validateRes.data;
      
      const reposRes = await axios.post(`${BACKEND_URL}/api/github/repos`, { token: tokenToAuth.trim() });
      
      const loginTime = Date.now();
      setGithubToken(tokenToAuth.trim());
      setGithubUser(userObj);
      setGithubRepos(reposRes.data);
      
      localStorage.setItem('chronicle_github_token', tokenToAuth.trim());
      localStorage.setItem('chronicle_github_user', JSON.stringify(userObj));
      localStorage.setItem('chronicle_github_login_time', loginTime.toString());
      setTokenInput('');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleGithubDisconnect = useCallback(() => {
    setGithubToken('');
    setGithubUser(null);
    setGithubRepos([]);
    localStorage.removeItem('chronicle_github_token');
    localStorage.removeItem('chronicle_github_user');
    localStorage.removeItem('chronicle_github_login_time');
  }, []);

  // Connect to socket and load repositories on mount
  useEffect(() => {
    socketRef.current = io(BACKEND_URL);
    
    socketRef.current.on('connect', () => {
      console.log('Socket client connected successfully');
    });

    socketRef.current.on('ingestion_progress', (data) => {
      console.log('Ingestion progress socket event:', data);
      dispatch(updateIngestionProgress(data));
      
      // If ingestion completed or failed, reload repo metadata and active repo details
      if (data.step === 'completed' || data.step === 'failed') {
        const savedUser = localStorage.getItem('chronicle_github_user');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            if (parsed?.username) fetchRepos(parsed.username);
          } catch (e) {
            console.error("Error parsing user from storage", e);
          }
        }
        if (activeRepoIdRef.current && data.repoId === activeRepoIdRef.current) {
          fetchRepoDetails(activeRepoIdRef.current);
        }
      }
    });

    socketRef.current.on('agent_trace', (data) => {
      console.log('Agent trace socket event:', data);
      setAgentTrace(data);
    });

    // Check for OAuth Token or Error in URL parameters (callback redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl) {
      handleAuthenticateToken(tokenFromUrl);
      // Clean up URL query parameter without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorFromUrl) {
      setAuthLoading(false);
      alert(`GitHub Authorization: ${errorFromUrl}`);
      // Clean up URL query parameter without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Reload active token if present in localStorage and within 1 hour
      const savedToken = localStorage.getItem('chronicle_github_token');
      const savedUser = localStorage.getItem('chronicle_github_user');
      const savedTime = localStorage.getItem('chronicle_github_login_time');
      
      if (savedToken && savedUser && savedTime) {
        const elapsed = Date.now() - parseInt(savedTime, 10);
        if (elapsed > 3600000) {
          handleGithubDisconnect();
        } else {
          setGithubToken(savedToken);
          setGithubUser(JSON.parse(savedUser));
          axios.post(`${BACKEND_URL}/api/github/repos`, { token: savedToken })
            .then(res => setGithubRepos(res.data))
            .catch(err => console.error("Error reloading user repos on mount", err));
        }
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [dispatch, fetchRepos, fetchRepoDetails, handleAuthenticateToken, handleGithubDisconnect]);

  // Auto-logout session timer after 1 hour (3600000 ms) for security
  useEffect(() => {
    if (!githubToken) return;

    const savedTime = localStorage.getItem('chronicle_github_login_time');
    const loginTime = savedTime ? parseInt(savedTime, 10) : Date.now();
    const elapsed = Date.now() - loginTime;
    const remainingTime = 3600000 - elapsed;

    if (remainingTime <= 0) {
      handleGithubDisconnect();
      alert('Your GitHub session has expired after 1 hour for security. Please sign in again.');
    } else {
      const timer = setTimeout(() => {
        handleGithubDisconnect();
        alert('Your GitHub session has expired after 1 hour for security. Please sign in again.');
      }, remainingTime);
      return () => clearTimeout(timer);
    }
  }, [githubToken, handleGithubDisconnect]);

  // Handle active repository changes: Join socket room, load details & chat
  useEffect(() => {
    if (activeRepoId) {
      if (socketRef.current) {
        socketRef.current.emit('join_repo', activeRepoId);
      }
      setViewMode('workspace');
      fetchRepoDetails(activeRepoId);
      startChatSession(activeRepoId);
    } else {
      setViewMode('connect');
      setMessages([]);
      setChatSession(null);
      setCommits([]);
      setDecisions([]);
      setAgentTrace(null);
    }
  }, [activeRepoId, fetchRepoDetails, startChatSession]);

  // Trigger Real GitHub OAuth App Login
  const handleGitHubOAuthLogin = () => {
    setAuthLoading(true);
    window.location.href = `${BACKEND_URL}/api/github/oauth/login`;
  };

  // Fetch user repositories whenever githubUser changes
  useEffect(() => {
    if (githubUser?.username) {
      fetchRepos(githubUser.username);
    } else {
      dispatch(setRepos([]));
    }
  }, [githubUser, fetchRepos, dispatch]);

  // Connect repository manually
  const handleConnectRepo = async (e) => {
    e.preventDefault();
    if (!repoUrlInput.trim() || !githubUser) return;

    setConnectLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/repos/connect`, {
        repoUrl: repoUrlInput.trim(),
        githubToken: githubToken || undefined,
        githubUsername: githubUser.username
      });
      dispatch(addRepo(res.data));
      dispatch(setActiveRepoId(res.data._id));
      setRepoUrlInput('');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setConnectLoading(false);
    }
  };

  // Connect repository from user's authenticated repo list
  const handleIngestUserRepo = async (repoName) => {
    if (!githubUser) return;
    try {
      const res = await axios.post(`${BACKEND_URL}/api/repos/connect`, {
        repoUrl: `https://github.com/${repoName}`,
        githubToken: githubToken || undefined,
        githubUsername: githubUser.username
      });
      dispatch(addRepo(res.data));
      dispatch(setActiveRepoId(res.data._id));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDeleteRepo = async (repoId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to disconnect this repository and delete all decision history?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/repos/${repoId}`);
      dispatch(deleteRepoInState(repoId));
    } catch (err) {
      alert(err.message);
    }
  };

  // Chat messaging
  const handleSendMessage = async (content) => {
    if (!chatSession || chatLoading) return;

    setMessages(prev => [...prev, { role: 'user', content }]);
    setChatLoading(true);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/chat/session/${chatSession._id}/message`, {
        content
      });
      setMessages(res.data.messages);
    } catch (err) {
      console.error("Error sending message", err);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'I encountered an error querying the decision agent. Please check that the agent-service is running.', 
        }
      ]);
    } finally {
      setChatLoading(false);
      setAgentTrace(null);
    }
  };

  // Manual Decision extraction
  const handleExtractDecision = async (e) => {
    e.preventDefault();
    if (!extractFilePath.trim() || !activeRepoId || extractLoading) return;

    setExtractLoading(true);
    setExtractionMsg("Connecting to langgraph agent to BLAME and review commits...");
    try {
      const res = await axios.post(`${BACKEND_URL}/api/repos/${activeRepoId}/extract-decision`, {
        filePath: extractFilePath.trim()
      });
      
      setExtractionMsg(`Extracted decision: "${res.data.summary || 'No changes found'}"`);
      setExtractFilePath('');
      
      const decisionsRes = await axios.get(`${BACKEND_URL}/api/repos/${activeRepoId}/decisions`);
      setDecisions(decisionsRes.data);
    } catch (err) {
      setExtractionMsg(`Extraction failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setExtractLoading(false);
      setAgentTrace(null);
    }
  };

  // Citation Click -> Stratigraphy Scroll and Highlight
  const handleCitationClick = (cit) => {
    if (commits.length === 0) return;

    let timeVal = null;

    if (cit.type === 'commit' && cit.sha) {
      const commit = commits.find(c => c.sha.startsWith(cit.sha) || cit.sha.startsWith(c.sha));
      if (commit) {
        timeVal = new Date(commit.author.date).getTime();
      }
    } else if (cit.type === 'pr' && cit.number) {
      const decision = decisions.find(d => d.prNumber === cit.number);
      if (decision && decision.commitSha) {
        const commit = commits.find(c => c.sha === decision.commitSha);
        if (commit) {
          timeVal = new Date(commit.author.date).getTime();
        }
      }
      if (!timeVal) {
        const commit = commits.find(c => c.message.includes(`#${cit.number}`) || c.message.includes(`PR #${cit.number}`));
        if (commit) {
          timeVal = new Date(commit.author.date).getTime();
        }
      }
    }

    if (timeVal !== null) {
      const sorted = [...commits].sort((a, b) => new Date(a.author.date).getTime() - new Date(b.author.date).getTime());
      const oldest = new Date(sorted[0].author.date).getTime();
      const newest = new Date(sorted[sorted.length - 1].author.date).getTime();
      
      const duration = newest - oldest || 1;
      const eraDuration = duration / 5;
      
      const index = Math.floor((timeVal - oldest) / eraDuration);
      const eraId = Math.min(Math.max(index, 0), 4);
      
      setHighlightedEraId(eraId);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-soil text-parchment overflow-hidden font-sans select-none">
      
      {/* Top Banner App Name */}
      <div className="h-14 bg-soil-dark border-b border-ochre/15 px-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-ochre p-0.5 shadow-lg shadow-ochre/10 shrink-0">
            <svg className="w-full h-full rounded-md" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="14" fill="#E5A853"/>
              <rect x="4" y="4" width="56" height="56" rx="11" fill="#1D1A16"/>
              <path d="M12 18H52" stroke="#E5A853" strokeWidth="6" strokeLinecap="round"/>
              <path d="M12 32H52" stroke="#F5F0E6" strokeWidth="6" strokeLinecap="round"/>
              <path d="M12 46H52" stroke="#3AAFA9" strokeWidth="6" strokeLinecap="round"/>
              <path d="M32 20L43 32L32 44L21 32Z" fill="#E5A853" stroke="#1D1A16" strokeWidth="3"/>
              <circle cx="32" cy="32" r="3" fill="#1D1A16"/>
            </svg>
          </div>
          <div>
            <h1 className="font-display text-lg font-extrabold tracking-widest uppercase text-parchment">
              Chronicle
            </h1>
            <p className="text-[8px] font-mono text-ochre tracking-widest uppercase font-bold leading-none mt-0.5">
              Code Decision Archaeology
            </p>
          </div>
        </div>
        
        {activeRepo && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-parchment/70 bg-surface px-3 py-1 rounded-md border border-ochre/10 flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-ochre/70" />
              {activeRepo.owner}/{activeRepo.name}
            </span>
            {activeRepo.ingestionStatus === 'completed' && (
              <span className="text-[9px] font-mono uppercase bg-teal/10 border border-teal/30 text-teal px-2 py-0.5 rounded-full flex items-center gap-1">
                <Activity className="w-2.5 h-2.5 animate-pulse" /> Indexed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        
        {/* Left Side: Strata Cross Section (40% width on Desktop, full width on Mobile) */}
        <div className="w-full md:w-[40%] h-[50vh] md:h-full shrink-0 min-w-[320px]">
          <StrataPanel
            activeRepo={activeRepo || null}
            commits={commits}
            decisions={decisions}
            highlightedEraId={highlightedEraId}
            onClearHighlight={() => setHighlightedEraId(null)}
          />
        </div>

        {/* Right Side: Chat Workspace or Connect Screen (60% width) */}
        <div className="flex-1 h-[50vh] md:h-full min-w-0">
          
          {viewMode === 'connect' || !activeRepo ? (
            
            /* CONNECT SCREEN */
            <div className="h-full w-full bg-soil-dark overflow-y-auto p-6 md:p-10 flex flex-col gap-8 justify-start scrollbar-thin">
              
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-mono tracking-widest text-ochre uppercase font-black">Excavation Site Registry</span>
                <h2 className="font-display text-3xl font-extrabold text-parchment">Connect Codebase</h2>
                <p className="text-xs text-parchment/60 font-sans max-w-lg leading-relaxed">
                  Ingest commits, branches, and pull request comments from GitHub to begin reconstructing engineering choices.
                </p>
              </div>

              {/* GitHub OAuth / PAT Authentication Block */}
              <div className="p-5 bg-surface border border-ochre/15 rounded-xl space-y-4 max-w-xl shadow-2xl">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <Github className="w-5 h-5 text-ochre" />
                    <span className="text-sm font-bold text-parchment">GitHub Authentication</span>
                  </div>
                  {githubUser && (
                    <span className="text-[9px] font-mono bg-teal/10 border border-teal/20 text-teal px-2 py-0.5 rounded-full">
                      Authorized
                    </span>
                  )}
                </div>

                {!githubUser ? (
                  <div className="space-y-4">
                    <p className="text-[11px] text-parchment/50 font-sans leading-relaxed">
                      Authorize Chronicle to access your repositories via GitHub App permissions or input a Personal Access Token.
                    </p>

                    <button
                      onClick={handleGitHubOAuthLogin}
                      disabled={authLoading}
                      className="w-full bg-ochre hover:bg-ochre/90 disabled:bg-surface border border-ochre/25 text-soil px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                    >
                      {authLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-soil" />
                          Connecting to GitHub...
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          Sign in with GitHub
                        </>
                      )}
                    </button>

                    <div className="pt-2 border-t border-ochre/10">
                      <button
                        type="button"
                        onClick={() => setShowPatInput(!showPatInput)}
                        className="text-[10px] font-mono text-ochre/80 hover:text-ochre flex items-center gap-1 cursor-pointer transition select-none"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>{showPatInput ? 'Hide Token Input' : 'Or authenticate with Personal Access Token (PAT)'}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${showPatInput ? 'rotate-180' : ''}`} />
                      </button>

                      {showPatInput && (
                        <form onSubmit={(e) => { e.preventDefault(); handleAuthenticateToken(tokenInput); }} className="space-y-3 mt-3 pt-3 border-t border-ochre/5 animate-sediment-build">
                          <p className="text-[10px] text-parchment/40 font-mono">Input a PAT token with `repo` read scope:</p>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={tokenInput}
                              onChange={(e) => setTokenInput(e.target.value)}
                              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                              className="flex-1 bg-soil border border-ochre/15 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-ochre/40 text-parchment placeholder:text-parchment/20"
                              required
                              disabled={authLoading}
                            />
                            <button
                              type="submit"
                              disabled={authLoading || !tokenInput.trim()}
                              className="bg-ochre/20 hover:bg-ochre text-ochre hover:text-soil border border-ochre/35 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 cursor-pointer flex items-center gap-1"
                            >
                              {authLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Auth'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-sediment-build">
                    <div className="flex items-center gap-3 bg-soil/50 p-2.5 rounded border border-ochre/10">
                      {githubUser.avatarUrl ? (
                        <img 
                          src={githubUser.avatarUrl} 
                          alt={githubUser.username} 
                          className="w-8 h-8 rounded-full border border-ochre/20 shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-ochre flex items-center justify-center text-soil font-bold text-xs">
                          @
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-xs font-bold text-parchment">@{githubUser.username}</p>
                        <p className="text-[10px] font-mono text-parchment/40">GitHub developer session active</p>
                      </div>
                      <button 
                        onClick={handleGithubDisconnect}
                        className="text-[9px] font-mono uppercase bg-rust/10 hover:bg-rust/20 border border-rust/35 text-rust px-2.5 py-1 rounded cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>

                    <div className="space-y-2.5 pt-1.5">
                      <h4 className="font-display text-sm font-black text-parchment">Your Repositories</h4>
                      {githubRepos.length === 0 ? (
                        <p className="text-[11px] text-parchment/40 italic">No repositories found or access token lacks repository permissions.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                          {githubRepos.map((mr) => {
                            const connected = repos.find(r => r.owner === mr.owner && r.name === mr.repoName);
                            const ingProgress = connected ? ingestionProgress[connected._id] : null;
                            const isIngesting = connected?.ingestionStatus === 'ingesting' || (ingProgress && ingProgress.step !== 'completed' && ingProgress.step !== 'failed');

                            return (
                              <div key={mr.name} className="p-3.5 bg-soil/40 border border-ochre/10 rounded-lg flex flex-col justify-between gap-3 relative overflow-hidden group hover:border-ochre/30 transition">
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-parchment block truncate" title={mr.name}>
                                    {mr.name}
                                  </span>
                                  <p className="text-[10px] text-parchment/40 line-clamp-2 leading-relaxed">{mr.description}</p>
                                </div>

                                <div className="pt-1.5">
                                  {!connected ? (
                                    <button
                                      onClick={() => handleIngestUserRepo(mr.name)}
                                      className="w-full bg-ochre/10 hover:bg-ochre text-ochre hover:text-soil border border-ochre/35 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                                    >
                                      Ingest Repo
                                    </button>
                                  ) : connected.ingestionStatus === 'completed' ? (
                                    <button
                                      onClick={() => dispatch(setActiveRepoId(connected._id))}
                                      className="w-full bg-teal/10 hover:bg-teal text-teal hover:text-soil border border-teal/35 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                                    >
                                      Open Dig Site
                                    </button>
                                  ) : isIngesting ? (
                                    <div className="w-full text-center text-[9px] font-mono text-ochre/75 py-1 px-3 border border-ochre/20 bg-ochre/5 rounded animate-pulse">
                                      Ingesting...
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => dispatch(setActiveRepoId(connected._id))}
                                      className="w-full bg-ochre/10 border border-ochre/35 px-3 py-1.5 rounded text-[10px] font-bold text-ochre/50 cursor-not-allowed"
                                      disabled
                                    >
                                      Ingestion Status: {connected.ingestionStatus}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Connection Input form */}
              <div className="p-5 bg-surface border border-ochre/15 rounded-xl space-y-3.5 max-w-xl shadow-2xl">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-ochre" />
                  <span className="text-sm font-bold text-parchment">Connect Custom Repository</span>
                </div>
                <p className="text-[11px] text-parchment/50 font-sans leading-relaxed">
                  Enter any public GitHub repository (e.g. `facebook/react` or full GitHub URL) to start importing its codebase timeline.
                </p>
                <form onSubmit={handleConnectRepo} className="flex gap-2">
                  <input
                    type="text"
                    value={repoUrlInput}
                    onChange={(e) => setRepoUrlInput(e.target.value)}
                    placeholder={githubUser ? "e.g. facebook/react" : "Sign in with GitHub above to connect repositories..."}
                    className="flex-1 bg-soil border border-ochre/15 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-ochre/40 text-parchment placeholder:text-parchment/30 transition shadow-inner font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={connectLoading || !githubUser}
                  />
                  <button
                    type="submit"
                    disabled={connectLoading || !repoUrlInput.trim() || !githubUser}
                    className="bg-ochre hover:bg-ochre/90 disabled:bg-surface border border-ochre/25 text-soil rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition shrink-0 cursor-pointer animate-pulse-glow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connectLoading ? <Loader2 className="w-4 h-4 animate-spin text-soil" /> : <Plus className="w-4 h-4" />}
                  </button>
                </form>
              </div>

              {/* Connected Repos list */}
              {repos.length > 0 && (
                <div className="space-y-3 max-w-xl">
                  <h4 className="font-display text-sm font-black text-parchment">Connected Repositories ({repos.length})</h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                    {repos.map((repo) => {
                      const ingProgress = ingestionProgress[repo._id];
                      const isIngesting = repo.ingestionStatus === 'ingesting' || (ingProgress && ingProgress.step !== 'completed' && ingProgress.step !== 'failed');

                      return (
                        <div
                          key={repo._id}
                          className="group p-3 bg-surface border border-ochre/10 rounded-lg flex items-center justify-between gap-4 hover:border-ochre/30 transition select-none"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <GitBranch className="w-4 h-4 text-ochre/60 shrink-0" />
                            <div className="overflow-hidden">
                              <span className="text-xs font-bold text-parchment truncate block">
                                {repo.owner}/{repo.name}
                              </span>
                              
                              {isIngesting && ingProgress ? (
                                <span className="text-[9px] font-mono text-ochre flex items-center gap-1.5 animate-pulse mt-0.5">
                                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                  {ingProgress.message || 'Ingesting...'}
                                </span>
                              ) : repo.errorMessage ? (
                                <span className="text-[9px] font-mono text-rust flex items-center gap-1 mt-0.5">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  Error: {repo.errorMessage}
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono text-parchment/40 mt-0.5 block">
                                  Status: {repo.ingestionStatus}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {repo.ingestionStatus === 'completed' && (
                              <button
                                onClick={() => dispatch(setActiveRepoId(repo._id))}
                                className="bg-ochre/15 hover:bg-ochre border border-ochre/35 hover:border-ochre text-ochre hover:text-soil px-2.5 py-1 rounded text-[10px] font-mono uppercase transition cursor-pointer"
                              >
                                Dig
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDeleteRepo(repo._id, e)}
                              className="text-parchment/40 hover:text-rust p-1 border border-transparent hover:border-rust/20 rounded transition"
                              title="Disconnect repository"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          ) : (
            
            /* ACTIVE WORKSPACE */
            <div className="h-full w-full flex flex-col overflow-hidden bg-soil">
              
              <div className="flex-1 flex overflow-hidden min-h-0">
                
                {/* Chat Column */}
                <div className="flex-1 flex flex-col min-w-0 h-full border-r border-ochre/10 relative">
                  
                  <ChatPanel
                    activeRepo={activeRepo}
                    messages={messages}
                    chatLoading={chatLoading}
                    agentTrace={agentTrace}
                    onSendMessage={handleSendMessage}
                    onCitationClick={handleCitationClick}
                    onNavigateToConnect={() => dispatch(setActiveRepoId(null))}
                    isExtractorOpen={isExtractorOpen}
                    onToggleExtractor={() => setIsExtractorOpen(!isExtractorOpen)}
                  />
                </div>

                {/* Collapsible Sidebar: Target Extraction + Mini Stats */}
                <div className={`transition-all duration-300 ease-in-out shrink-0 bg-soil-dark border-l border-ochre/10 flex flex-col h-full overflow-y-auto scrollbar-thin ${
                  isExtractorOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'
                }`}>
                  <div className="p-5 space-y-6">
                    
                    {/* Manual Extraction Form */}
                    <div className="p-4 bg-surface border border-ochre/15 rounded-xl space-y-4">
                      <h3 className="text-xs text-parchment font-bold uppercase tracking-wider flex items-center gap-2 pb-1 border-b border-ochre/10">
                        <FileSearch className="w-4 h-4 text-ochre" />
                        Target Extraction
                      </h3>
                      <p className="text-[11px] text-parchment/60 leading-relaxed font-sans">
                        Trigger the LangGraph pipeline to crawl git blame and PR reviews, extracting engineering decisions for a specific target file path.
                      </p>
                      <form onSubmit={handleExtractDecision} className="space-y-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] text-parchment/40 font-mono uppercase tracking-widest block">File path in repository</label>
                          <input
                            type="text"
                            value={extractFilePath}
                            onChange={(e) => setExtractFilePath(e.target.value)}
                            placeholder="e.g. src/index.js"
                            className="w-full bg-soil border border-ochre/15 rounded px-2.5 py-2 text-xs focus:outline-none focus:border-ochre/40 text-parchment placeholder:text-parchment/20"
                            required
                            disabled={extractLoading}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={extractLoading || !extractFilePath.trim()}
                          className="w-full bg-ochre hover:bg-ochre/90 disabled:bg-surface border border-ochre/25 text-soil text-[10px] font-bold uppercase tracking-wider py-2 rounded transition cursor-pointer"
                        >
                          {extractLoading ? (
                            <span className="flex items-center justify-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin text-soil" />
                              Extracting...
                            </span>
                          ) : (
                            'Extract Decisions'
                          )}
                        </button>
                      </form>
                      {extractionMsg && (
                        <div className="p-2.5 bg-soil/70 border border-ochre/10 rounded text-[9px] font-mono text-ochre leading-normal break-words">
                          {extractionMsg}
                        </div>
                      )}
                    </div>

                    {/* Repository Ingestion Stats */}
                    <div className="p-4 bg-surface border border-ochre/15 rounded-xl space-y-3.5">
                      <h3 className="text-xs text-parchment font-bold uppercase tracking-wider flex items-center gap-2 pb-1 border-b border-ochre/10">
                        <Database className="w-4 h-4 text-ochre" />
                        Archaeology Stats
                      </h3>
                      <div className="space-y-2 text-[10px] font-mono">
                        <div className="flex justify-between border-b border-soil/80 pb-1.5">
                          <span className="text-parchment/40">Repository Owner:</span>
                          <span className="font-bold">{activeRepo.owner}</span>
                        </div>
                        <div className="flex justify-between border-b border-soil/80 pb-1.5">
                          <span className="text-parchment/40">Repository Name:</span>
                          <span className="font-bold">{activeRepo.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-soil/80 pb-1.5">
                          <span className="text-parchment/40">Commits Ingested:</span>
                          <span className="font-bold text-ochre">{commits.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-parchment/40">Decisions Unearthed:</span>
                          <span className="font-bold text-teal">{decisions.length}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      </div>

    </div>
  );
}

export default App;
