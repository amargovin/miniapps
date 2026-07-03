import React, { useState, useEffect, useCallback } from 'react';
import type { ProjectJson, SceneJson, PhaseRange, WhisperJson } from '../types/project';
import { checkAvSync, checkTextPlacement, checkShowDontTell, checkFontSize, getCheckIcon } from '../lib/checks';
import { formatFrames } from '../lib/whisperUtils';

interface Props {
  project: ProjectJson | null;
  scene: SceneJson | null;
  phase: PhaseRange | null;
  phases: PhaseRange[];
  onReviewPhase: (sceneId: string, phaseId: number, status: 'approved' | 'rejected', notes?: string) => Promise<unknown>;
  onBulkReview: (sceneId: string, action: 'approve-all' | 'reject-all', notes?: string) => Promise<void>;
  onSendCommand: (command: string, params: Record<string, unknown>) => Promise<unknown>;
}

interface CheckResult {
  avSync: { status: string; tooltip: string; driftFrames: number };
  textPlacement: { status: string; tooltip: string; violations: string[] };
  showDontTell: { status: string; tooltip: string };
  fontSize: { status: string; tooltip: string; violations: string[] };
}

export default function Inspector({
  project,
  scene,
  phase,
  phases,
  onReviewPhase,
  onBulkReview,
  onSendCommand,
}: Props) {
  const [rejectMode, setRejectMode] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tsxSource, setTsxSource] = useState<string | null>(null);
  const [whisperData, setWhisperData] = useState<WhisperJson | null>(null);
  const [checkResults, setCheckResults] = useState<CheckResult | null>(null);

  // Load TSX and Whisper data when scene changes
  useEffect(() => {
    if (!scene?.id) { setTsxSource(null); setWhisperData(null); return; }

    Promise.all([
      fetch(`/api/scenes/${scene.id}/tsx`).then(r => r.ok ? r.text() : null).catch(() => null),
      fetch(`/api/scenes/${scene.id}/whisper`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([tsx, whisper]) => {
      setTsxSource(tsx);
      setWhisperData(whisper);
    });
  }, [scene?.id]);

  // Run automated checks when phase or tsx changes
  useEffect(() => {
    if (!tsxSource || !phase || !project) { setCheckResults(null); return; }

    const fps = project.fps;
    const avSync = checkAvSync(phase.startFrame, '', whisperData, fps);
    const textPlacement = checkTextPlacement(tsxSource);
    const showDontTell = checkShowDontTell(tsxSource, phase.id, null);
    const fontSize = checkFontSize(tsxSource);

    setCheckResults({ avSync, textPlacement, showDontTell, fontSize });
  }, [tsxSource, phase?.id, phase?.startFrame, whisperData, project]);

  // Reset state when phase changes
  useEffect(() => {
    setRejectMode(false);
    setNotes('');
    setError(null);
  }, [phase?.id, scene?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!phase || !scene) return;
      // Don't fire when typing in textarea
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleApprove();
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRejectMode(true);
      }
      if (e.key === 'Escape') {
        setRejectMode(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [phase, scene]);

  const handleApprove = useCallback(async () => {
    if (!scene?.id || !phase?.id) return;
    if (phase.status === 'approved') return; // Already approved
    setSaving(true);
    setError(null);
    try {
      await onReviewPhase(scene.id, phase.id, 'approved');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [scene?.id, phase?.id, phase?.status, onReviewPhase]);

  const handleReject = useCallback(async () => {
    if (!scene?.id || !phase?.id) return;
    if (!notes.trim()) { setError('Notes are required to reject a phase'); return; }
    setSaving(true);
    setError(null);
    try {
      await onReviewPhase(scene.id, phase.id, 'rejected', notes.trim());
      setRejectMode(false);
      setNotes('');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [scene?.id, phase?.id, notes, onReviewPhase]);

  const handleFixPhase = useCallback(async () => {
    if (!scene?.id || !phase?.id || !notes.trim()) return;
    try {
      await onSendCommand('fix_phase', {
        sceneId: scene.id,
        phaseId: phase.id,
        notes: notes.trim(),
        reviewJson: `review/${scene.id}_review.json`,
      });
    } catch (e) {
      setError(String(e));
    }
  }, [scene?.id, phase?.id, notes, onSendCommand]);

  if (!scene) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-xs p-4 text-center">
        Select a scene or phase to inspect
      </div>
    );
  }

  if (!phase) {
    // Scene-level inspector
    return (
      <div className="p-4">
        <div className="text-sm font-semibold text-gray-200 mb-4">{scene.id}</div>

        {/* Scene stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-[#22222a] rounded p-2 text-center">
            <div className="text-lg font-bold text-green-400">{scene.approvedCount}</div>
            <div className="text-[10px] text-gray-500">Approved</div>
          </div>
          <div className="bg-[#22222a] rounded p-2 text-center">
            <div className="text-lg font-bold text-red-400">{scene.rejectedCount}</div>
            <div className="text-[10px] text-gray-500">Rejected</div>
          </div>
          <div className="bg-[#22222a] rounded p-2 text-center">
            <div className="text-lg font-bold text-gray-400">{scene.pendingCount}</div>
            <div className="text-[10px] text-gray-500">Pending</div>
          </div>
          <div className="bg-[#22222a] rounded p-2 text-center">
            <div className="text-lg font-bold text-gray-200">{scene.phaseCount}</div>
            <div className="text-[10px] text-gray-500">Total</div>
          </div>
        </div>

        {/* File status */}
        <div className="space-y-1 mb-4 text-xs">
          <FileStatus label="TSX" has={scene.hasTsx} />
          <FileStatus label="Audio" has={scene.hasAudio} />
          <FileStatus label="Whisper" has={scene.hasWhisper} />
          <FileStatus label="Render" has={scene.hasRender} />
        </div>

        {/* Bulk actions */}
        <div className="space-y-2">
          <button
            onClick={() => onBulkReview(scene.id, 'approve-all')}
            className="btn btn-approve w-full text-xs"
            disabled={scene.pendingCount === 0 && scene.rejectedCount === 0}
          >
            Approve All Phases
          </button>
          <button
            onClick={() => {
              const notes = prompt('Rejection notes for all phases:');
              if (notes) onBulkReview(scene.id, 'reject-all', notes);
            }}
            className="btn btn-reject w-full text-xs"
          >
            Reject All Phases
          </button>
        </div>
      </div>
    );
  }

  // Phase-level inspector
  const fps = project?.fps || 30;
  const isApproved = phase.status === 'approved';
  const isRejected = phase.status === 'rejected';

  return (
    <div className="p-4 space-y-4">
      {/* Phase header */}
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{scene.id}</div>
        <div className="text-sm font-semibold text-gray-200">
          Phase {phase.id} of {phases.length}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {formatFrames(phase.duration, fps)}
          {' · '}frames {phase.startFrame}–{phase.endFrame}
        </div>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium
        ${isApproved ? 'bg-green-900/30 text-green-300' :
          isRejected ? 'bg-red-900/30 text-red-300' :
          'bg-[#2a2a35] text-gray-400'}`}>
        {isApproved ? '✓ Approved' : isRejected ? '✗ Rejected' : '○ Pending Review'}
      </div>

      {/* Previous rejection notes */}
      {isRejected && phase.notes && (
        <div className="bg-red-950/20 border border-red-900/30 rounded p-2 text-xs">
          <div className="text-[10px] text-red-400 uppercase mb-1">Rejection Notes</div>
          <div className="text-gray-300">{phase.notes}</div>
        </div>
      )}

      {/* Automated checks */}
      {checkResults && (
        <div className="bg-[#22222a] rounded p-3 space-y-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Auto Checks</div>
          <CheckRow label="AV Sync" result={checkResults.avSync} />
          <CheckRow label="Text Placement" result={checkResults.textPlacement} />
          <CheckRow label="Show Don't Tell" result={checkResults.showDontTell} />
          <CheckRow label="Font Size" result={checkResults.fontSize} />
        </div>
      )}

      <div className="border-t border-[#2e2e38] pt-4 space-y-2">
        {/* Approve button */}
        {!rejectMode && (
          <button
            onClick={handleApprove}
            disabled={saving || isApproved}
            className={`btn w-full text-sm ${isApproved ? 'opacity-50 cursor-default' : 'btn-approve'}`}
            title="Approve (A)"
          >
            {saving ? 'Saving...' : isApproved ? '✓ Approved' : '✓ Approve Phase'}
          </button>
        )}

        {/* Reject button */}
        {!rejectMode && !isApproved && (
          <button
            onClick={() => setRejectMode(true)}
            className="btn btn-reject w-full text-sm"
            title="Reject (R)"
          >
            ✗ Reject Phase
          </button>
        )}

        {/* Reject form */}
        {rejectMode && (
          <div className="space-y-2">
            <textarea
              className="w-full bg-[#18181f] border border-[#3e3e4a] rounded p-2 text-xs text-gray-200 resize-none focus:outline-none focus:border-red-500"
              rows={4}
              placeholder="Rejection notes (required)..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={saving || !notes.trim()}
                className="btn btn-reject flex-1 text-xs"
              >
                {saving ? 'Saving...' : '✗ Confirm Reject'}
              </button>
              <button
                onClick={() => { setRejectMode(false); setNotes(''); }}
                className="btn btn-default text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Fix Phase command (send to Claude Code) */}
        {(isRejected || rejectMode) && notes.trim() && (
          <button
            onClick={handleFixPhase}
            className="btn btn-primary w-full text-xs"
            title="Send fix instruction to Claude Code"
          >
            Send to Claude Code: Fix Phase
          </button>
        )}

        {/* Unlock approved phase */}
        {isApproved && (
          <button
            onClick={() => {
              if (confirm('Unlock this phase for re-review?')) {
                onReviewPhase(scene.id, phase.id, 'rejected', 'Unlocked for re-review').catch(() => {});
              }
            }}
            className="btn btn-default w-full text-xs opacity-60 hover:opacity-100"
          >
            Unlock for Re-review
          </button>
        )}

        {error && (
          <div className="text-red-400 text-xs mt-1 p-2 bg-red-950/20 rounded">{error}</div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="text-[10px] text-gray-600 text-center">
        A = Approve · R = Reject · Esc = Cancel
      </div>
    </div>
  );
}

function FileStatus({ label, has }: { label: string; has: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={has ? 'text-green-400' : 'text-red-500'}>
        {has ? '✓' : '✗'} {has ? 'OK' : 'Missing'}
      </span>
    </div>
  );
}

function CheckRow({ label, result }: {
  label: string;
  result: { status: string; tooltip: string };
}) {
  const { icon, color } = getCheckIcon(result.status);
  return (
    <div className="flex items-center justify-between" title={result.tooltip}>
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`${color} text-xs font-mono`} title={result.tooltip}>{icon}</span>
    </div>
  );
}
