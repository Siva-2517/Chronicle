import React, { useState, useEffect, useRef } from 'react';
import { StalenessBadge } from './StalenessBadge';
import { Calendar, GitPullRequest, GitCommit, ChevronDown } from 'lucide-react';

export const StrataPanel = ({
  activeRepo,
  commits,
  decisions,
  highlightedEraId,
  onClearHighlight
}) => {
  const [expandedEra, setExpandedEra] = useState(null);
  const [animate, setAnimate] = useState(false);
  const eraRefs = useRef({});

  // Detect user preferences for reduced motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Trigger stagger animation when commits finish loading
  useEffect(() => {
    if (activeRepo && commits.length > 0) {
      if (prefersReducedMotion) {
        setAnimate(true);
      } else {
        setAnimate(false);
        const timer = setTimeout(() => setAnimate(true), 50);
        return () => clearTimeout(timer);
      }
    } else {
      setAnimate(false);
    }
  }, [activeRepo, commits.length, prefersReducedMotion]);

  // Handle outside scroll/highlight request
  useEffect(() => {
    if (highlightedEraId !== null) {
      setExpandedEra(highlightedEraId);
      const element = eraRefs.current[highlightedEraId];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      const timer = setTimeout(() => {
        onClearHighlight();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightedEraId, onClearHighlight]);

  if (!activeRepo || commits.length === 0) {
    // Empty state: undisturbed soil block
    return (
      <div className="flex flex-col h-full w-full bg-soil-dark border-r border-ochre/10 relative overflow-hidden select-none p-8 justify-center items-center">
        <div className="absolute inset-0 bg-repeat bg-[radial-gradient(#1D1A16_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ochre/5 to-transparent pointer-events-none" />
        <div className="absolute top-[20%] left-[-10%] w-[120%] h-[3px] bg-gradient-to-r from-transparent via-ochre/20 to-transparent rotate-2 pointer-events-none" />
        <div className="absolute top-[60%] left-[-10%] w-[120%] h-[4px] bg-gradient-to-r from-transparent via-rust/10 to-transparent -rotate-1 pointer-events-none" />
        
        <div className="text-center max-w-sm relative z-10 space-y-6">
          <div className="inline-flex justify-center items-center w-20 h-20 rounded-2xl bg-surface border border-ochre/30 shadow-2xl shadow-ochre/5 text-ochre mb-2">
            <span className="font-display text-4xl font-black">C</span>
          </div>
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-wide text-parchment mb-3">
              Undisturbed Soil
            </h2>
            <p className="text-sm font-sans text-parchment/60 leading-relaxed">
              Connect a GitHub repository to start digging. Each layer represents an era of codebase decisions waiting to be unearthed.
            </p>
          </div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-ochre/70 bg-ochre/5 border border-ochre/20 px-3 py-1.5 rounded-full inline-block animate-pulse-glow">
            Connect a repo to start digging.
          </div>
        </div>
      </div>
    );
  }

  // Calculate chronological eras
  const sortedCommits = [...commits].sort((a, b) => new Date(a.author.date).getTime() - new Date(b.author.date).getTime());
  const oldestTime = new Date(sortedCommits[0].author.date).getTime();
  const newestTime = new Date(sortedCommits[sortedCommits.length - 1].author.date).getTime();
  const totalDuration = newestTime - oldestTime || 1;
  const interval = totalDuration / 5;

  const eras = Array.from({ length: 5 }).map((_, index) => {
    const start = oldestTime + index * interval;
    const end = oldestTime + (index + 1) * interval;
    
    const eraCommits = commits.filter(c => {
      const t = new Date(c.author.date).getTime();
      return index === 4 ? t >= start && t <= end : t >= start && t < end;
    });

    const eraDecisions = decisions.filter(d => {
      if (d.commitSha) {
        return eraCommits.some(ec => ec.sha === d.commitSha);
      }
      const t = new Date(d.createdAt).getTime();
      return index === 4 ? t >= start && t <= end : t >= start && t < end;
    });

    let status = 'neutral';
    if (eraDecisions.length > 0) {
      const hasStale = eraDecisions.some(d => d.staleness.checked && d.staleness.isStale);
      status = hasStale ? 'stale' : 'verified';
    }

    const names = [
      'Genesis Era',
      'Foundation Era',
      'Expansion Era',
      'Consolidation Era',
      'Modern Era'
    ];

    return {
      id: index,
      name: names[index],
      startDate: new Date(start),
      endDate: new Date(end === newestTime ? newestTime : end),
      commits: eraCommits,
      decisions: eraDecisions,
      status
    };
  });

  const displayEras = [...eras].reverse();
  const totalCommitsCount = commits.length;

  return (
    <div className="flex flex-col h-full w-full bg-soil text-parchment relative overflow-y-auto border-r border-ochre/15">
      <div className="absolute inset-0 bg-repeat bg-[radial-gradient(#1D1A16_1px,transparent_1px)] [background-size:12px_12px] opacity-10 pointer-events-none" />
      
      <div className="p-5 border-b border-ochre/10 bg-soil-dark flex justify-between items-center z-10 shrink-0">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-ochre uppercase">Chronological strata</span>
          <h2 className="font-display text-xl font-bold text-parchment mt-0.5">Repo Excavation</h2>
        </div>
        <div className="text-[10px] font-mono bg-ochre/5 border border-ochre/20 text-ochre px-2 py-0.5 rounded">
          {totalCommitsCount} COMMITS INDEXED
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 w-full">
        {displayEras.map((era) => {
          const commitCount = era.commits.length;
          const isExpanded = expandedEra === era.id;
          const isHighlighted = highlightedEraId === era.id;
          
          const flexShare = Math.max(commitCount, 3);
          
          let borderClass = 'border-ochre/10 hover:border-ochre/30';
          let bgClass = 'bg-[#1b1814]';
          let textureOverlay = null;

          if (era.status === 'verified') {
            borderClass = isHighlighted ? 'border-teal animate-pulse' : 'border-teal/20 hover:border-teal/50';
            bgClass = 'bg-[#142220]';
            textureOverlay = (
              <div className="absolute inset-0 bg-gradient-to-r from-teal/0 via-teal/5 to-teal/0 pointer-events-none" />
            );
          } else if (era.status === 'stale') {
            borderClass = isHighlighted ? 'border-rust animate-pulse' : 'border-rust/35 hover:border-rust/60';
            bgClass = 'bg-[#221613]';
            textureOverlay = (
              <div className="absolute inset-0 bg-repeat bg-[radial-gradient(#C1502E_2px,transparent_2px)] [background-size:14px_14px] opacity-10 pointer-events-none" />
            );
          } else if (isHighlighted) {
            borderClass = 'border-ochre animate-pulse';
          }

          const staggerIndex = 4 - era.id;
          const animationStyle = animate
            ? {
                opacity: 1,
                transform: 'translateY(0)',
                transitionDelay: prefersReducedMotion ? '0ms' : `${staggerIndex * 120}ms`,
              }
            : {
                opacity: 0,
                transform: prefersReducedMotion ? 'translateY(0)' : 'translateY(24px)',
              };

          return (
            <div
              key={era.id}
              ref={(el) => (eraRefs.current[era.id] = el)}
              style={{ 
                flexGrow: flexShare,
                ...animationStyle
              }}
              className={`border-b group relative overflow-hidden transition-all duration-500 ease-out flex flex-col min-h-[80px] ${bgClass} ${borderClass} ${
                isHighlighted ? 'ring-1 ring-ochre/30 shadow-lg shadow-ochre/5' : ''
              }`}
            >
              {textureOverlay}
              
              {isHighlighted && (
                <div className="absolute inset-0 bg-ochre/5 border-l-4 border-ochre animate-pulse z-20 pointer-events-none" />
              )}

              <div
                onClick={() => setExpandedEra(isExpanded ? null : era.id)}
                className="p-4 cursor-pointer flex justify-between items-center select-none relative z-10 w-full"
              >
                <div className="space-y-1 overflow-hidden pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm tracking-wide font-black uppercase text-parchment">
                      {era.name}
                    </span>
                    <span className="text-[10px] font-mono text-parchment/40">
                      Era {era.id + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-parchment/50">
                    <Calendar className="w-3 h-3 text-ochre/70" />
                    <span>
                      {era.startDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </span>
                    <span>—</span>
                    <span>
                      {era.endDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-mono uppercase text-parchment/60 font-semibold">
                      {commitCount} Commits
                    </span>
                    {era.decisions.length > 0 && (
                      <span className={`text-[9px] font-mono uppercase font-bold tracking-wider mt-0.5 ${
                        era.status === 'stale' ? 'text-rust' : 'text-teal'
                      }`}>
                        {era.decisions.length} Decisions
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-parchment/40 transition-transform duration-300 ${
                    isExpanded ? 'rotate-180 text-ochre' : 'group-hover:text-parchment'
                  }`} />
                </div>
              </div>

              <div className={`grid transition-all duration-300 ease-in-out relative z-10 ${
                isExpanded ? 'grid-rows-[1fr] border-t border-ochre/5 bg-soil-dark/50' : 'grid-rows-[0fr]'
              }`}>
                <div className="overflow-hidden">
                  <div className="p-4 space-y-4 font-sans text-xs">
                    
                    {era.decisions.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-[9px] font-mono tracking-widest text-ochre uppercase font-bold border-b border-ochre/10 pb-1.5">
                          Unearthed Decisions
                        </div>
                        <div className="space-y-3">
                          {era.decisions.map((dec) => (
                            <div 
                              key={dec._id}
                              className="p-3 bg-surface border border-ochre/15 rounded-lg flex flex-col gap-2 relative hover:border-ochre/30 transition duration-150"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-mono text-[10px] text-ochre truncate max-w-[200px]" title={dec.filePath}>
                                  {dec.filePath.split('/').pop()}{dec.functionName ? ` ➔ ${dec.functionName}()` : ''}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {dec.confidence_score !== undefined && (
                                    <span className="text-[9px] font-mono bg-ochre/10 border border-ochre/20 text-ochre px-1.5 py-0.5 rounded" title="AI confidence score extracted from text logs">
                                      {Math.round(dec.confidence_score * 100)}% Conf
                                    </span>
                                  )}
                                  <StalenessBadge staleness={dec.staleness} />
                                </div>
                              </div>
                              
                              <p className="text-[11px] leading-relaxed text-parchment/90 font-medium">
                                {dec.summary}
                              </p>

                              <div className="flex gap-2 mt-1">
                                {dec.commitSha && (
                                  <a
                                    href={`https://github.com/${activeRepo.owner}/${activeRepo.name}/commit/${dec.commitSha}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-[9px] text-parchment/40 hover:text-ochre flex items-center gap-1 bg-parchment/5 px-2 py-0.5 rounded border border-parchment/10 hover:border-ochre/30 transition"
                                  >
                                    <GitCommit className="w-2.5 h-2.5" />
                                    {dec.commitSha.substring(0, 7)}
                                  </a>
                                )}
                                {dec.prNumber && (
                                  <a
                                    href={`https://github.com/${activeRepo.owner}/${activeRepo.name}/pull/${dec.prNumber}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-[9px] text-parchment/40 hover:text-ochre flex items-center gap-1 bg-parchment/5 px-2 py-0.5 rounded border border-parchment/10 hover:border-ochre/30 transition"
                                  >
                                    <GitPullRequest className="w-2.5 h-2.5" />
                                    PR #{dec.prNumber}
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-[9px] font-mono tracking-widest text-parchment/40 uppercase font-bold border-b border-parchment/10 pb-1.5">
                          Unearthed Decisions
                        </div>
                        <p className="text-[10px] italic text-parchment/50">
                          No decision records extracted in this era yet. Use chat or target extraction on the right to mine decisions!
                        </p>
                      </div>
                    )}

                    <div className="space-y-2.5 pt-1">
                      <div className="text-[9px] font-mono tracking-widest text-parchment/40 uppercase font-bold border-b border-parchment/10 pb-1.5 flex justify-between items-center">
                        <span>Sediment History (Commits)</span>
                        <span className="text-[9px] text-parchment/30 normal-case font-normal">
                          {era.commits.length} commits total
                        </span>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin">
                        {era.commits.slice(0, 15).map((c) => (
                          <div 
                            key={c.sha} 
                            className="p-2 bg-soil-dark/40 border border-parchment/5 hover:border-parchment/10 rounded flex justify-between gap-4"
                          >
                            <div className="space-y-0.5 overflow-hidden">
                              <p className="text-[11px] font-medium text-parchment/80 truncate pr-2">
                                {c.message}
                              </p>
                              <p className="text-[9px] font-mono text-parchment/40">
                                {c.author.name} • {new Date(c.author.date).toLocaleDateString()}
                              </p>
                            </div>
                            <a
                              href={c.htmlUrl || `https://github.com/${activeRepo.owner}/${activeRepo.name}/commit/${c.sha}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[10px] text-ochre/80 hover:text-ochre flex items-center gap-0.5 self-center shrink-0"
                            >
                              {c.sha.substring(0, 7)}
                            </a>
                          </div>
                        ))}
                        {era.commits.length > 15 && (
                          <div className="text-[8px] font-mono text-center text-parchment/30 py-1">
                            + {era.commits.length - 15} older commits in sediment
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
