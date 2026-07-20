import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Sparkles, Compass, GitPullRequest, GitCommit, ArrowRightLeft, FileSearch } from 'lucide-react';

export const ChatPanel = ({
  activeRepo,
  messages,
  chatLoading,
  agentTrace,
  onSendMessage,
  onCitationClick,
  onNavigateToConnect,
  isExtractorOpen,
  onToggleExtractor
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading, agentTrace]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  // Helper to parse and render text with interactive inline citation tags
  const renderMessageContent = (content, citations = []) => {
    if (!citations || citations.length === 0) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    const searchTerms = [];
    const termMap = new Map();

    citations.forEach((cit) => {
      if (cit.type === 'pr' && cit.number) {
        const prStr1 = `PR #${cit.number}`;
        const prStr2 = `#${cit.number}`;
        searchTerms.push(escapeRegExp(prStr1), escapeRegExp(prStr2));
        termMap.set(prStr1.toLowerCase(), cit);
        termMap.set(prStr2.toLowerCase(), cit);
      } else if (cit.type === 'commit' && cit.sha) {
        const fullSha = cit.sha;
        const shortSha = cit.sha.substring(0, 7);
        searchTerms.push(escapeRegExp(fullSha), escapeRegExp(shortSha));
        termMap.set(fullSha.toLowerCase(), cit);
        termMap.set(shortSha.toLowerCase(), cit);
      }
    });

    if (searchTerms.length === 0) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    const regex = new RegExp(`(${searchTerms.join('|')})`, 'gi');
    const parts = content.split(regex);

    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {parts.map((part, i) => {
          const matchKey = part.toLowerCase();
          const matchingCit = termMap.get(matchKey);

          if (matchingCit) {
            const isPr = matchingCit.type === 'pr';
            return (
              <button
                key={i}
                onClick={() => onCitationClick(matchingCit)}
                className="inline-flex items-center gap-1 font-mono text-xs bg-surface border border-ochre/30 hover:border-ochre text-ochre hover:text-parchment px-1.5 py-0.5 rounded transition mx-1 select-none font-bold align-baseline shadow-sm cursor-pointer"
                title={`Click to scroll to Era containing ${isPr ? `PR #${matchingCit.number}` : `Commit ${matchingCit.sha?.substring(0, 7)}`}`}
              >
                {isPr ? (
                  <GitPullRequest className="w-2.5 h-2.5 text-ochre/70" />
                ) : (
                  <GitCommit className="w-2.5 h-2.5 text-ochre/70" />
                )}
                {!isPr && part.length > 10 ? part.substring(0, 7) : part}
              </button>
            );
          }

          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Get color for agent trace bar depending on step
  const getTraceColorClass = (step) => {
    switch (step) {
      case 'extracting':
        return 'bg-ochre';
      case 'verifying':
        return 'bg-teal';
      case 'synthesizing':
        return 'bg-ochre';
      case 'ingesting':
        return 'bg-ochre';
      case 'failed':
        return 'bg-rust';
      default:
        return 'bg-teal';
    }
  };

  const isTraceActive = agentTrace && agentTrace.step !== 'idle' && agentTrace.step !== 'completed';
  const showTrace = isTraceActive || chatLoading;
  const currentStep = agentTrace?.step || (chatLoading ? 'synthesizing' : 'idle');
  const currentMsg = agentTrace?.message || (chatLoading ? 'Synthesizing response from commit logs...' : '');

  return (
    <div className="flex flex-col h-full w-full bg-soil-dark text-parchment relative overflow-hidden">
      
      <div className="p-4 border-b border-ochre/10 bg-soil flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-surface border border-ochre/20 flex items-center justify-center text-ochre shrink-0 shadow-md">
            <Compass className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <h3 className="font-display text-sm font-bold truncate text-parchment">
              Decision Chat
            </h3>
            <p className="text-[10px] font-mono text-parchment/40 truncate">
              Digging in {activeRepo.owner}/{activeRepo.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExtractor}
            className={`flex items-center gap-1.5 text-[10px] font-mono uppercase border px-3 py-1.5 rounded-lg transition shrink-0 shadow-md ${
              isExtractorOpen
                ? 'bg-ochre border-ochre text-soil font-bold'
                : 'bg-surface border-ochre/25 text-ochre hover:bg-ochre/10 hover:border-ochre'
            }`}
          >
            <FileSearch className="w-3 h-3" />
            Target Extractor
          </button>

          <button
            onClick={onNavigateToConnect}
            className="flex items-center gap-1 text-[10px] font-mono uppercase bg-surface hover:bg-ochre/10 border border-ochre/25 hover:border-ochre text-ochre hover:text-parchment px-3 py-1.5 rounded-lg transition shrink-0 shadow-md"
          >
            <ArrowRightLeft className="w-3 h-3" />
            Switch Repo
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-surface border border-ochre/15 flex items-center justify-center text-ochre mb-2">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <h3 className="font-display text-lg font-bold">Consult Chronicle AI</h3>
            <p className="text-xs text-parchment/50 leading-relaxed font-sans">
              Ask questions about the causal history and design choices in the repository. The AI archaeologist will crawl commits, PR comments, and decisions to give a cited answer.
            </p>
            <div className="bg-surface border border-ochre/10 p-3 rounded-lg text-left text-[11px] font-mono text-ochre/80 space-y-2 w-full shadow-lg">
              <p className="font-bold text-[10px] uppercase text-parchment/40 tracking-wider">Try asking:</p>
              <p className="italic">"Why did we write this cache layer?"</p>
              <p className="italic">"Why did we replace library X with Y?"</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isAi = msg.role === 'assistant';
            return (
              <div
                key={index}
                className={`flex gap-4 max-w-2xl ${
                  isAi ? 'mr-auto' : 'ml-auto flex-row-reverse'
                }`}
              >
                <div className={`w-8 h-8 rounded-full border shrink-0 flex items-center justify-center text-xs font-bold font-mono shadow-md ${
                  isAi 
                    ? 'bg-surface border-ochre/30 text-ochre' 
                    : 'bg-ochre/10 border-ochre text-ochre'
                }`}>
                  {isAi ? 'A' : 'U'}
                </div>

                <div className="flex flex-col gap-2 overflow-hidden max-w-full">
                  <div className={`rounded-xl p-4 text-xs font-sans leading-relaxed border shadow-xl ${
                    isAi
                      ? 'bg-surface border-ochre/10 text-parchment'
                      : 'bg-ochre/10 border-ochre/30 text-parchment font-medium'
                  }`}>
                    {renderMessageContent(msg.content, msg.citations)}
                  </div>

                  {isAi && msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1 items-center">
                      <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-widest mr-1">
                        Citations:
                      </span>
                      {msg.citations.map((cit, ci) => {
                        const isPr = cit.type === 'pr';
                        return (
                          <button
                            key={ci}
                            onClick={() => onCitationClick(cit)}
                            className="font-mono text-[9px] bg-surface/50 hover:bg-surface border border-ochre/25 hover:border-ochre text-ochre/80 hover:text-parchment px-2 py-0.5 rounded flex items-center gap-1 transition"
                          >
                            {isPr ? (
                              <GitPullRequest className="w-2.5 h-2.5 text-ochre/50" />
                            ) : (
                              <GitCommit className="w-2.5 h-2.5 text-ochre/50" />
                            )}
                            {isPr ? `PR #${cit.number}` : `Commit ${cit.sha?.substring(0, 7)}`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={`px-6 transition-all duration-350 overflow-hidden shrink-0 border-t border-ochre/5 bg-soil/40 ${
        showTrace ? 'h-11 py-2 opacity-100' : 'h-0 py-0 opacity-0'
      }`}>
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 w-full bg-surface border border-ochre/10 rounded-full overflow-hidden relative">
            <div 
              className={`h-full absolute left-0 top-0 transition-all duration-500 animate-scan ${getTraceColorClass(currentStep)}`} 
              style={{ width: '40%' }}
            />
          </div>
          
          <div className="flex justify-between items-center text-[10px] font-mono text-parchment/65 leading-none">
            <span className="font-bold uppercase tracking-wider text-ochre">
              [EXCAVATING]: {currentStep}
            </span>
            <span className="truncate max-w-[80%] text-right font-medium">
              {currentMsg}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-ochre/10 bg-soil bg-gradient-to-b from-transparent to-soil-dark z-10 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={chatLoading}
            placeholder={chatLoading ? "Excavation pipeline running..." : "Ask why code was written this way..."}
            className="flex-1 bg-surface border border-ochre/15 rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-ochre/50 text-parchment placeholder:text-parchment/30 transition shadow-inner font-sans"
          />
          <button
            type="submit"
            disabled={chatLoading || !input.trim()}
            className="bg-ochre hover:bg-ochre/90 disabled:bg-surface disabled:border disabled:border-ochre/10 disabled:text-parchment/30 text-soil rounded-lg px-5 py-3 transition duration-150 flex items-center justify-center gap-1.5 shrink-0 shadow-lg cursor-pointer"
          >
            {chatLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-ochre" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span className="text-xs font-bold tracking-wide uppercase font-sans">Dig</span>
              </>
            )}
          </button>
        </form>
      </div>

    </div>
  );
};
