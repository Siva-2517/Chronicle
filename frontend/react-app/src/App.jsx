import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import axios from 'axios';
import { 
  GitBranch, 
  MessageSquare, 
  Activity, 
  Trash2, 
  Plus, 
  ExternalLink, 
  Send, 
  Compass, 
  Clock, 
  AlertCircle, 
  Loader2, 
  BookOpen, 
  History 
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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

function App() {
  const dispatch = useDispatch();
  const { repos, activeRepoId, ingestionProgress, loading, error } = useSelector(state => state.repo);
  
  const [repoUrlInput, setRepoUrlInput] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'timeline'
  
  // Chat state
  const [chatSession, setChatSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Repo details (commits, PRs)
  const [commits, setCommits] = useState([]);
  const [prs, setPrs] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [extractFilePath, setExtractFilePath] = useState('');
  const [extractionMsg, setExtractionMsg] = useState('');
  const [extractLoading, setExtractLoading] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const activeRepo = repos.find(r => r._id === activeRepoId);

  // Connect to socket and fetch initial repos
  useEffect(() => {
    socketRef.current = io(BACKEND_URL);
    
    socketRef.current.on('connect', () => {
      console.log('Connected to socket server');
    });

    socketRef.current.on('ingestion_progress', (data) => {
      console.log('Ingestion progress:', data);
      dispatch(updateIngestionProgress(data));
      
      // If active repo finished ingesting, reload list & details
      if (data.step === 'completed' || data.step === 'failed') {
        fetchRepos();
      }
    });

    fetchRepos();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [dispatch]);

  // Join socket room whenever active repository changes, and fetch its metadata
  useEffect(() => {
    if (activeRepoId && socketRef.current) {
      socketRef.current.emit('join_repo', activeRepoId);
      fetchRepoDetails(activeRepoId);
      // Start/retrieve chat session for this repo
      startChatSession(activeRepoId);
    } else {
      setMessages([]);
      setChatSession(null);
      setCommits([]);
      setPrs([]);
    }
  }, [activeRepoId]);

  // Autoscroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRepos = async () => {
    dispatch(setLoading(true));
    try {
      const res = await axios.get(`${BACKEND_URL}/api/repos`);
      dispatch(setRepos(res.data));
    } catch (err) {
      dispatch(setError(err.message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const fetchRepoDetails = async (repoId) => {
    setDetailsLoading(true);
    try {
      const [commitsRes, prsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/repos/${repoId}/commits`),
        axios.get(`${BACKEND_URL}/api/repos/${repoId}/prs`)
      ]);
      setCommits(commitsRes.data);
      setPrs(prsRes.data);
    } catch (err) {
      console.error("Error fetching repo details", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleConnectRepo = async (e) => {
    e.preventDefault();
    if (!repoUrlInput.trim()) return;

    setConnectLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/repos/connect`, {
        repoUrl: repoUrlInput
      });
      dispatch(addRepo(res.data));
      dispatch(setActiveRepoId(res.data._id));
      setRepoUrlInput('');
      
      // Join socket room immediately
      if (socketRef.current) {
        socketRef.current.emit('join_repo', res.data._id);
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setConnectLoading(false);
    }
  };

  const handleDeleteRepo = async (repoId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to disconnect this repository and delete all history?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/repos/${repoId}`);
      dispatch(deleteRepoInState(repoId));
    } catch (err) {
      alert(err.message);
    }
  };

  const startChatSession = async (repoId) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/chat/session`, { repoId });
      setChatSession(res.data);
      setMessages([]);
    } catch (err) {
      console.error("Error starting chat session", err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !chatSession || chatLoading) return;

    const userMsg = inputMessage;
    setInputMessage('');
    
    // Add user message locally immediately
    setMessages(prev => [...prev, { role: 'user', content: userMsg, citations: [] }]);
    setChatLoading(true);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/chat/session/${chatSession._id}/message`, {
        content: userMsg
      });
      // Update full history from backend response
      setMessages(res.data.messages);
    } catch (err) {
      console.error("Error sending message", err);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error while processing your request. Please check the services are running.', 
          citations: [] 
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExtractDecision = async (e) => {
    e.preventDefault();
    if (!extractFilePath.trim() || !activeRepoId || extractLoading) return;

    setExtractLoading(true);
    setExtractionMsg("Archaeologist Agent looking up git blame and PR reviews...");
    try {
      const res = await axios.post(`${BACKEND_URL}/api/repos/${activeRepoId}/extract-decision`, {
        filePath: extractFilePath
      });
      setExtractionMsg(`Successfully extracted decision: "${res.data.summary}"`);
      setExtractFilePath('');
      
      // Refresh timeline if in timeline view
      if (activeTab === 'timeline') {
        // Trigger a reload of timeline iframe by refreshing active repo info
        fetchRepoDetails(activeRepoId);
      }
    } catch (err) {
      setExtractionMsg(`Extraction failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setExtractLoading(false);
    }
  };

  const getStatusBadge = (status, repoId) => {
    const progress = ingestionProgress[repoId];
    if (status === 'ingesting' || (progress && progress.step !== 'completed' && progress.step !== 'failed')) {
      return (
        <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
          <Loader2 className="w-3 h-3 animate-spin" /> Ingesting
        </span>
      );
    }
    if (status === 'completed') {
      return (
        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
          Completed
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/20">
          Failed
        </span>
      );
    }
    return (
      <span className="text-xs bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded-full border border-slate-500/20">
        Pending
      </span>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* 1. SIDEBAR */}
      <div className="w-80 border-r border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col h-full shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Compass className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Chronicle
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Code Archaeology</p>
          </div>
        </div>

        {/* Connect Repo Form */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <form onSubmit={handleConnectRepo} className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-medium">Connect Repository</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={repoUrlInput}
                onChange={(e) => setRepoUrlInput(e.target.value)}
                placeholder="e.g. facebook/react"
                className="flex-1 bg-slate-800/80 border border-slate-700 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500 text-slate-100 placeholder:text-slate-500"
                disabled={connectLoading}
              />
              <button
                type="submit"
                disabled={connectLoading || !repoUrlInput}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded p-1.5 transition duration-150 flex items-center justify-center shrink-0"
              >
                {connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>

        {/* Repo List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
          <h2 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Connected Repos</h2>
          
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : repos.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6 italic">No repositories connected. Connect one above to start.</p>
          ) : (
            repos.map((repo) => (
              <div
                key={repo._id}
                onClick={() => dispatch(setActiveRepoId(repo._id))}
                className={`group p-3 rounded-lg border transition duration-150 cursor-pointer flex flex-col gap-2 ${
                  activeRepoId === repo._id
                    ? 'bg-blue-950/20 border-blue-500/60 shadow-lg shadow-blue-500/5'
                    : 'bg-slate-800/30 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <GitBranch className={`w-4 h-4 shrink-0 ${activeRepoId === repo._id ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className="text-sm font-semibold truncate text-slate-200">
                      {repo.owner}/{repo.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteRepo(repo._id, e)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-0.5 rounded transition duration-150 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  {getStatusBadge(repo.ingestionStatus, repo._id)}
                </div>

                {/* Progress Detail */}
                {ingestionProgress[repo._id] && ingestionProgress[repo._id].step !== 'completed' && ingestionProgress[repo._id].step !== 'failed' && (
                  <div className="w-full mt-1.5">
                    <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-1 transition-all duration-300"
                        style={{
                          width: `${
                            ingestionProgress[repo._id].total > 0
                              ? (ingestionProgress[repo._id].current / ingestionProgress[repo._id].total) * 100
                              : 10
                          }%`
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 truncate">
                      {ingestionProgress[repo._id].message}
                    </p>
                  </div>
                )}
                
                {repo.errorMessage && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> Error ingesting repo
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. MAIN CONTENT VIEW */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        {activeRepo ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-slate-100">{activeRepo.owner}/{activeRepo.name}</span>
                {activeRepo.ingestionStatus === 'completed' && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Activity className="w-3 h-3" /> fully indexed
                  </span>
                )}
              </div>

              {/* View Tabs */}
              <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition duration-150 ${
                    activeTab === 'chat'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Decision Chat
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition duration-150 ${
                    activeTab === 'timeline'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="w-3.5 h-3.5" /> Decision Timeline
                </button>
              </div>
            </div>

            {/* Ingestion warning */}
            {activeRepo.ingestionStatus === 'ingesting' && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-400 px-6 py-2 text-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ingestion is currently running. Chat answers may be incomplete until indexing finishes.
              </div>
            )}

            {/* TAB PANELS */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* CHAT TAB */}
              {activeTab === 'chat' && (
                <div className="flex-1 flex overflow-hidden">
                  
                  {/* Left Chat Area */}
                  <div className="flex-1 flex flex-col h-full bg-slate-950/20">
                    {/* Message Log */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                            <Compass className="w-6 h-6 text-blue-400" />
                          </div>
                          <h3 className="font-bold text-base mb-1.5">Ask Chronicle AI</h3>
                          <p className="text-sm text-slate-400">
                            Ask why a function or file was designed the way it was. For example:
                            <span className="block mt-2 italic text-blue-400">"Why did we write this cache layer?"</span>
                            <span className="block mt-1 italic text-blue-400">"Why are we not using axios directly?"</span>
                          </p>
                        </div>
                      ) : (
                        messages.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex gap-3.5 max-w-3xl ${
                              msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                              msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400'
                            }`}>
                              {msg.role === 'user' ? 'U' : 'AI'}
                            </div>
                            
                            <div className="flex flex-col gap-2.5">
                              <div className={`rounded-xl p-4 text-sm leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-500/10'
                                  : 'bg-slate-900 border border-slate-800 text-slate-200'
                              }`}>
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                              </div>

                              {/* Citations list for assistant response */}
                              {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                                <div className="flex flex-wrap gap-2 px-1">
                                  <span className="text-[10px] text-slate-500 font-semibold uppercase self-center mr-1">Citations:</span>
                                  {msg.citations.map((cit, ci) => (
                                    <a
                                      key={ci}
                                      href={cit.url || '#'}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-blue-400 px-2 py-0.5 rounded flex items-center gap-1 transition duration-150"
                                    >
                                      {cit.type === 'commit' ? (
                                        <>
                                          <Clock className="w-3 h-3 text-slate-500" />
                                          Commit {cit.sha.substring(0, 7)}
                                        </>
                                      ) : (
                                        <>
                                          <BookOpen className="w-3 h-3 text-slate-500" />
                                          PR #{cit.number}
                                        </>
                                      )}
                                      <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      {chatLoading && (
                        <div className="flex gap-3.5 max-w-3xl">
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center animate-spin">
                            <Loader2 className="w-4 h-4" />
                          </div>
                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-400 flex items-center gap-2">
                            <span>Archaeologist Agent querying history and analyzing code...</span>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input Bar */}
                    <div className="p-4 border-t border-slate-800 bg-slate-900/20 backdrop-blur-md">
                      <form onSubmit={handleSendMessage} className="flex gap-3">
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          placeholder="Ask why code was written this way..."
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 text-slate-100 placeholder:text-slate-500"
                          disabled={chatLoading}
                        />
                        <button
                          type="submit"
                          disabled={chatLoading || !inputMessage.trim()}
                          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg px-5 py-3 transition duration-150 flex items-center gap-1.5 shrink-0"
                        >
                          <Send className="w-4 h-4" />
                          <span className="text-sm font-semibold">Ask</span>
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Right Panel - Manual Decision Extractor */}
                  <div className="w-80 border-l border-slate-800 bg-slate-900/20 flex flex-col h-full shrink-0 overflow-y-auto p-4 gap-4">
                    <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
                      <h3 className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-400" />
                        Target Extraction
                      </h3>
                      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                        Manually trigger the LangGraph pipeline to analyze and index decisions for a specific file path.
                      </p>
                      <form onSubmit={handleExtractDecision} className="flex flex-col gap-3">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold mb-1 block">FILE PATH</label>
                          <input
                            type="text"
                            value={extractFilePath}
                            onChange={(e) => setExtractFilePath(e.target.value)}
                            placeholder="e.g. src/index.js"
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-slate-200"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={extractLoading || !extractFilePath.trim()}
                          className="w-full bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold py-2 rounded transition duration-150 flex items-center justify-center gap-1.5"
                        >
                          {extractLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Extracting...
                            </>
                          ) : (
                            'Extract Decisions'
                          )}
                        </button>
                      </form>
                      {extractionMsg && (
                        <div className="mt-3 p-2.5 bg-slate-950 border border-slate-850 rounded text-[10px] text-blue-400 leading-normal break-words">
                          {extractionMsg}
                        </div>
                      )}
                    </div>

                    {/* Mini stats */}
                    <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex flex-col gap-3 text-xs">
                      <h3 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Ingestion Stats</h3>
                      <div className="flex justify-between border-b border-slate-900/60 pb-1.5">
                        <span className="text-slate-400">Total Commits:</span>
                        <span className="font-bold">{commits.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Pull Requests:</span>
                        <span className="font-bold">{prs.length}</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TIMELINE TAB (Vue App Embed via iframe) */}
              {activeTab === 'timeline' && (
                <div className="flex-1 h-full w-full bg-slate-950 overflow-hidden">
                  <iframe 
                    src={`${import.meta.env.VITE_VUE_APP_URL || 'http://localhost:3001'}/?repoId=${activeRepoId}`}
                    title="Decision Timeline"
                    className="w-full h-full border-none bg-slate-950"
                  />
                </div>
              )}

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-900/80 flex items-center justify-center border border-slate-850 mb-6 shadow-xl">
              <Compass className="w-8 h-8 text-slate-500" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-200 mb-2">Welcome to Chronicle</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Connect a GitHub repository to index its commits and PR discussions. Chronicle extracts causal history so you can archaeology its decisions in real-time.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

export default App;
