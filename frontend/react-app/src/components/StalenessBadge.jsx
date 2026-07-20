import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export const StalenessBadge = ({ staleness }) => {
  if (!staleness || !staleness.checked) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-parchment/5 border-parchment/20 text-parchment/40">
        Unchecked
      </span>
    );
  }

  const isStale = staleness.isStale;
  const reason = staleness.reason || (isStale ? 'This decision is no longer active.' : 'This decision is verified.');

  return (
    <div className="relative group inline-flex items-center shrink-0 cursor-help">
      {isStale ? (
        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded border bg-rust/10 border-rust text-rust shadow-sm shadow-rust/5">
          <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
          Stale
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded border bg-teal/10 border-teal text-teal shadow-sm shadow-teal/5">
          <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
          Verified
        </span>
      )}
      
      {/* Premium custom tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 scale-95 opacity-0 pointer-events-none transition-all duration-200 origin-bottom group-hover:scale-100 group-hover:opacity-100 bg-surface border border-ochre/30 p-3 rounded-lg text-xs leading-relaxed text-parchment shadow-2xl z-30 font-sans">
        <p className={`font-bold text-[10px] uppercase tracking-widest mb-1.5 ${isStale ? 'text-rust' : 'text-teal'}`}>
          {isStale ? 'Decayed Premise' : 'Reasoning Holds'}
        </p>
        <p className="text-parchment/90 font-medium">{reason}</p>
        {/* Tooltip arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] w-2.5 h-2.5 rotate-45 bg-surface border-r border-b border-ochre/30" />
      </div>
    </div>
  );
};
