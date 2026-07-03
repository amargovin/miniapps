import React, { useState, useRef, useEffect } from 'react';
import type { PipelineState, LogLine, FileChangeEvent } from '../types/project';

interface Props {
  pipelineState: PipelineState;
  logs: LogLine[];
  fileChanges: FileChangeEvent[];
  onClearLogs: () => void;
}

const FILE_TYPE_ICON: Record<string, string> = {
  tsx: '⌗',
  audio: '♫',
  image: '▣',
  brief: '☰',
  review: '✓',
  ontology: '◈',
  whisper: '◉',
  command: '▶',
  other: '·',
};

export default function PipelineMonitor({ pipelineState, logs, fileChanges, onClearLogs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showFileChanges, setShowFileChanges] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest log
  useEffect(() => {
    if (expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, expanded]);

  const lastLog = logs[logs.length - 1];
  const progressPct = pipelineState.running ? pipelineState.progress : 0;

  const elapsedSecs = pipelineState.startedAt
    ? Math.floor((Date.now() - new Date(pipelineState.startedAt).getTime()) / 1000)
    : 0;

  return (
    <div className={`bg-[#15151a] border-t border-[#2e2e38] transition-all ${expanded ? 'h-60' : 'h-11'}`}>
      {/* Collapsed bar */}
      <div
        className="flex items-center gap-3 px-4 h-11 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status icon */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          pipelineState.running ? 'bg-blue-400 animate-pulse-blue' :
          lastLog?.level === 'error' ? 'bg-red-400' :
          lastLog?.level === 'success' ? 'bg-green-400' :
          'bg-gray-600'
        }`} />

        {/* Current operation */}
        <span className="text-xs text-gray-400 flex-1 truncate">
          {pipelineState.running
            ? `${pipelineState.sceneId} — ${pipelineState.stage} (${elapsedSecs}s)`
            : lastLog?.message
            ? lastLog.message.slice(0, 80)
            : 'Pipeline idle'}
        </span>

        {/* Progress bar */}
        {pipelineState.running && progressPct > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1 bg-[#2e2e38] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-blue-400 font-mono w-8 text-right">
              {progressPct.toFixed(0)}%
            </span>
          </div>
        )}

        {/* File change indicator */}
        {fileChanges.length > 0 && (
          <span className="text-[10px] text-gray-600 font-mono">
            {fileChanges.length} changes
          </span>
        )}

        {/* Expand toggle */}
        <span className={`text-gray-600 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▲
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="flex h-[calc(240px-44px)] gap-0">
          {/* Log panel */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-[#2e2e38]">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#2e2e38]">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide flex-1">Pipeline Log</span>
              <button
                onClick={(e) => { e.stopPropagation(); setShowFileChanges(!showFileChanges); }}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  showFileChanges ? 'bg-[#2a2a38] text-gray-300' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                File Changes
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onClearLogs(); }}
                className="text-[10px] text-gray-500 hover:text-gray-300 px-2"
              >
                Clear
              </button>
            </div>

            {!showFileChanges ? (
              <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-0.5">
                {logs.length === 0 && (
                  <div className="text-gray-600 italic p-2">No log output yet</div>
                )}
                {logs.map(line => (
                  <div key={line.id} className={`flex items-start gap-2 log-${line.level}`}>
                    <span className="text-gray-600 flex-shrink-0">{formatTime(line.timestamp)}</span>
                    <span className="break-all">{line.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-0.5">
                {fileChanges.length === 0 && (
                  <div className="text-gray-600 italic p-2">No file changes detected yet</div>
                )}
                {fileChanges.map((change, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-400">
                    <span className="text-gray-600 flex-shrink-0">{formatTime(new Date().toISOString())}</span>
                    <span className="text-gray-600">{FILE_TYPE_ICON[change.type] || '·'}</span>
                    <span className={`flex-shrink-0 text-[9px] ${
                      change.changeType === 'added' ? 'text-green-500' :
                      change.changeType === 'unlinked' ? 'text-red-500' :
                      'text-blue-400'
                    }`}>{change.changeType}</span>
                    <span className="truncate text-gray-400">{change.path}</span>
                    {change.sceneId && (
                      <span className="text-blue-400 text-[9px] flex-shrink-0">{change.sceneId}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  } catch {
    return '--:--:--';
  }
}
